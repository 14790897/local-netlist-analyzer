#!/usr/bin/env python3
"""validate-extension.py

JLCEDA .eext 扩展上架前自动化校验脚本。

校验范围 (16 条, 来源: docs/PUBLISHING.md 第 1 节):
  extension.json (8 项)
    1. name 字符集 5-30 字符 a-z0-9-
    2. uuid 严格 32 字符 a-z0-9
    3. version semver major.minor.patch
    4. publisher 不含邮箱/真名/手机号
    5. description 长度 50-300 字符
    6. categories 官方 8 值之一
    7. repository.type 官方 17 值之一 (如有)
    8. entry 指向的 .eext 包含 dist/index (间接验证)

  images/ (4 项)
    9. images.logo 文件存在
   10. images.logo 1:1 比例
   11. images.banner 文件存在
   12. images.banner JPEG + 64:27 比例

  Git 树 (1 项, 最常漏)
   13. git ls-tree HEAD images/ 包含 logo + banner (即 git 树有, 不仅是 working dir)

  文档 (2 项)
   14. README.md 存在
   15. CHANGELOG.md 存在

  隐私 (1 项)
   16. eext 内文本不含邮箱/11 位手机号 (--eext 模式)

用法:
  # 默认: 校验当前目录的 extension.json + images/
  python scripts/validate-extension.py

  # 校验已打好的 .eext 包
  python scripts/validate-extension.py --eext build/dist/myext_v1.0.0.eext

  # CI 友好: 通过退出码判断
  python scripts/validate-extension.py; echo $?  # 0=过, 1=有错

  # JSON 输出供 CI 解析
  python scripts/validate-extension.py --json
"""

import argparse
import json
import os
import re
import subprocess
import sys
import zipfile
from pathlib import Path

# ---------- 官方取值表 (来源: prodocs.lceda.cn extension-json.html) ----------

CATEGORIES = {"Schematic", "Symbol", "PCB", "Footprint", "Panel", "Library", "Project", "Other"}
REPO_TYPES = {
    "extension-store", "git", "mercurial", "svn", "ftp",
    "github", "gitlab", "gitlab-selfhosted",
    "gitee", "gitea", "bitbucket",
    "coding", "gnu-savannah", "gitbucket", "gogs",
}

# ---------- 校验函数 ----------

def check_name(name):
    """1. name 5-30 字符 a-z0-9-"""
    if not name or not isinstance(name, str):
        return False, "name 缺失或非字符串"
    if not (5 <= len(name) <= 30):
        return False, f"name 长度 {len(name)} 不在 5-30 范围内"
    if not re.fullmatch(r"[a-z0-9-]+", name):
        bad = sorted(set(c for c in name if not re.match(r"[a-z0-9-]", c)))
        return False, f"name 含非法字符: {bad!r} (只允许 a-z 0-9 -)"
    return True, f"OK ({len(name)} 字符)"

def check_uuid(uuid):
    """2. uuid 严格 32 字符 a-z0-9"""
    if not uuid or not isinstance(uuid, str):
        return False, "uuid 缺失或非字符串"
    if len(uuid) != 32:
        return False, f"uuid 长度 {len(uuid)} 不等于 32 (不能含横线)"
    if not re.fullmatch(r"[a-z0-9]+", uuid):
        return False, f"uuid 含非小写字母数字字符"
    if uuid == "00000000000000000000000000000000":
        return False, "uuid 是全 0 占位符 (build/packaged.ts 会替换)"
    return True, f"OK ({uuid[:8]}...)"

def check_version(ver):
    """3. version semver major.minor.patch"""
    if not ver or not isinstance(ver, str):
        return False, "version 缺失"
    if ver.startswith("v"):
        return False, f"version 不应以 'v' 开头 (那是 tag, 不是 version): {ver!r}"
    if not re.fullmatch(r"\d+\.\d+\.\d+", ver):
        return False, f"version 不是严格 semver major.minor.patch: {ver!r}"
    parts = [int(x) for x in ver.split(".")]
    if any(p < 0 for p in parts):
        return False, f"version 段不能为负: {ver!r}"
    return True, f"OK ({ver})"

def check_publisher(pub):
    """4. publisher 不含邮箱/真名/手机号"""
    if not pub or not isinstance(pub, str):
        return False, "publisher 缺失"
    # 邮箱检测
    if re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", pub):
        return False, f"publisher 含邮箱地址 (PII 风险): {pub!r}"
    # 11 位手机号检测 (中国)
    if re.search(r"\b1[3-9]\d{9}\b", pub):
        return False, f"publisher 含手机号 (PII 风险): {pub!r}"
    return True, f"OK ({pub!r})"

def check_description(desc):
    """5. description 长度 50-300 字符"""
    if not desc or not isinstance(desc, str):
        return False, "description 缺失"
    if len(desc) < 50:
        return False, f"description 太短 ({len(desc)} 字符, 建议 ≥ 50)"
    if len(desc) > 300:
        return False, f"description 太长 ({len(desc)} 字符, 建议 ≤ 300)"
    return True, f"OK ({len(desc)} 字符)"

def check_categories(cats):
    """6. categories 官方 8 值之一"""
    if not cats:
        return False, "categories 缺失"
    if isinstance(cats, str):
        cats = [cats]
    if not isinstance(cats, list):
        return False, f"categories 类型错: {type(cats).__name__}"
    bad = [c for c in cats if c not in CATEGORIES]
    if bad:
        return False, f"categories 含非法值: {bad!r} (官方只接受 {sorted(CATEGORIES)})"
    return True, f"OK ({cats})"

def check_repo_type(rt):
    """7. repository.type 官方 17 值之一 (如有)"""
    if rt is None:
        return True, "未设置 (可选)"
    if not isinstance(rt, str):
        return False, f"repository.type 不是字符串"
    if rt not in REPO_TYPES:
        return False, f"repository.type {rt!r} 不在官方 17 值中"
    return True, f"OK ({rt!r})"

def check_image_file(path, expected_ratio, expected_format=None):
    """校验单个图片文件: 存在 + 比例 + 格式"""
    from PIL import Image
    if not path.exists():
        return False, f"文件不存在: {path}"
    if path.stat().st_size > 5 * 1024 * 1024:
        return False, f"文件过大 ({path.stat().st_size} B, ≤ 5 MB)"
    try:
        with Image.open(path) as img:
            fmt = img.format
            w, h = img.size
            ratio = w / h
            if expected_format and fmt != expected_format:
                return False, f"格式 {fmt} 不符 (期望 {expected_format})"
            if abs(ratio - expected_ratio) > 0.01:
                return False, f"比例 {w}:{h} = {ratio:.4f} ≠ 期望 {expected_ratio:.4f}"
            return True, f"OK ({fmt} {w}×{h}, {path.stat().st_size:,} B)"
    except Exception as e:
        return False, f"PIL 打开失败: {e}"

def check_git_tree(logo_path, banner_path):
    """13. git ls-tree -r HEAD images/ 包含 logo + banner

    跨平台路径处理: Windows Path.relative_to 用反斜杠, git 输出用正斜杠,
    需统一成 posix 风格再比较。
    """
    images_dir = logo_path.parent
    try:
        # 用正斜杠传 git (git 在 Windows 上接受 /), -r 递归列出子文件
        rel_dir = images_dir.relative_to(Path.cwd()).as_posix()
        result = subprocess.run(
            ["git", "ls-tree", "-r", "HEAD", rel_dir],
            capture_output=True, text=True, check=True, cwd=Path.cwd()
        )
    except subprocess.CalledProcessError as e:
        return False, f"git ls-tree 失败: {e.stderr}"
    except FileNotFoundError:
        return None, "git 未安装或不在 PATH (跳过)"

    files_in_tree = set()
    for line in result.stdout.strip().splitlines():
        if not line:
            continue
        # 格式: <mode> <type> <hash>\t<name>
        parts = line.split("\t", 1)
        if len(parts) == 2:
            files_in_tree.add(parts[1])

    logo_rel = logo_path.relative_to(Path.cwd()).as_posix()
    banner_rel = banner_path.relative_to(Path.cwd()).as_posix()
    missing = []
    if logo_rel not in files_in_tree:
        missing.append(logo_path.name)
    if banner_rel not in files_in_tree:
        missing.append(banner_path.name)
    if missing:
        return False, f"git 树缺文件 (working dir 有但 git add 漏了): {missing}"
    file_count = len(files_in_tree)
    file_names = sorted(f.split("/")[-1] for f in files_in_tree)
    return True, f"OK ({file_count} 个文件: {', '.join(file_names)})"

def check_eext_privacy(eext_path):
    """16. eext 内文本不含邮箱/11 位手机号"""
    if not eext_path.exists():
        return None, f"eext 不存在: {eext_path}"
    EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
    PHONE = re.compile(r"\b1[3-9]\d{9}\b")
    issues = []
    with zipfile.ZipFile(eext_path) as z:
        for name in z.namelist():
            if not (name.endswith(".json") or name.endswith(".md") or name.endswith(".ts") or name.endswith(".js") or name.endswith(".html")):
                continue
            try:
                text = z.read(name).decode("utf-8", errors="ignore")
            except Exception:
                continue
            for m in EMAIL.finditer(text):
                issues.append(f"{name}: 邮箱 {m.group()!r}")
            for m in PHONE.finditer(text):
                issues.append(f"{name}: 手机号 {m.group()!r}")
            if len(issues) > 5:
                issues.append("... (截断)")
                break
    if issues:
        return False, "; ".join(issues)
    return True, "OK (无邮箱/手机号)"

# ---------- 主流程 ----------

def main():
    parser = argparse.ArgumentParser(description="JLCEDA extension 校验")
    parser.add_argument("--ext-dir", default=".", help="扩展根目录 (默认当前)")
    parser.add_argument("--eext", help="校验已打好的 .eext (隐含隐私检查)")
    parser.add_argument("--json", action="store_true", help="JSON 输出")
    parser.add_argument("--no-color", action="store_true")
    args = parser.parse_args()

    ext_dir = Path(args.ext_dir).resolve()
    ext_json = ext_dir / "extension.json"
    if not ext_json.exists():
        print(f"ERROR: {ext_json} 不存在", file=sys.stderr)
        sys.exit(2)

    with open(ext_json, encoding="utf-8") as f:
        cfg = json.load(f)

    images_cfg = cfg.get("images", {})
    logo_rel = images_cfg.get("logo", "./images/logo.png").lstrip("./")
    banner_rel = images_cfg.get("banner", "./images/banner.jpg").lstrip("./")
    logo_path = ext_dir / logo_rel
    banner_path = ext_dir / banner_rel

    # 6:4 比例 (1:1 = 1.0; 64:27 ≈ 2.3704)
    RATIO_SQUARE = 1.0
    RATIO_BANNER = 64 / 27

    checks = []

    # 1-7: extension.json 字段
    checks.append(("1. name",                *check_name(cfg.get("name", ""))))
    checks.append(("2. uuid",                *check_uuid(cfg.get("uuid", ""))))
    checks.append(("3. version",             *check_version(cfg.get("version", ""))))
    checks.append(("4. publisher (no PII)",  *check_publisher(cfg.get("publisher", ""))))
    checks.append(("5. description",         *check_description(cfg.get("description", ""))))
    checks.append(("6. categories",          *check_categories(cfg.get("categories"))))
    repo = cfg.get("repository", {}) or {}
    checks.append(("7. repository.type",     *check_repo_type(repo.get("type"))))

    # 8: entry 存在性 (本地校验 entry 路径; eext 内容在 --eext 模式另查)
    entry = cfg.get("entry", "./dist/index")
    if args.eext:
        with zipfile.ZipFile(args.eext) as z:
            entry_js = entry.lstrip("./") + ".js"
            if entry_js in z.namelist():
                checks.append(("8. entry (in eext)", True, f"OK ({entry_js})"))
            else:
                checks.append(("8. entry (in eext)", False, f"eext 内缺 {entry_js}"))
    else:
        checks.append(("8. entry (local)", None, f"未校验 (用 --eext 校验), 路径 {entry!r}"))

    # 9-12: images
    if logo_path.exists():
        checks.append(("9. images.logo 存在", True, f"OK ({logo_path})"))
        ok, msg = check_image_file(logo_path, RATIO_SQUARE, expected_format=None)
        checks.append(("10. images.logo 1:1", ok, msg))
    else:
        checks.append(("9. images.logo 存在", False, f"缺 {logo_path}"))
        checks.append(("10. images.logo 1:1", None, "跳过 (logo 缺失)"))

    if banner_path.exists():
        checks.append(("11. images.banner 存在", True, f"OK ({banner_path})"))
        ok, msg = check_image_file(banner_path, RATIO_BANNER, expected_format="JPEG")
        checks.append(("12. images.banner JPEG+64:27", ok, msg))
    else:
        checks.append(("11. images.banner 存在", False, f"缺 {banner_path}"))
        checks.append(("12. images.banner JPEG+64:27", None, "跳过 (banner 缺失)"))

    # 13: git 树
    ok, msg = check_git_tree(logo_path, banner_path)
    if ok is None:
        checks.append(("13. git 树 (banner/logo tracked)", None, msg))
    else:
        checks.append(("13. git 树 (banner/logo tracked)", ok, msg))

    # 14-15: 文档
    readme = ext_dir / "README.md"
    cl = ext_dir / "CHANGELOG.md"
    checks.append(("14. README.md 存在",     readme.exists(), "OK" if readme.exists() else f"缺 {readme}"))
    checks.append(("15. CHANGELOG.md 存在",  cl.exists(),      "OK" if cl.exists()      else f"缺 {cl}"))

    # 16: eext 隐私
    if args.eext:
        ok, msg = check_eext_privacy(Path(args.eext))
        if ok is None:
            checks.append(("16. eext 隐私", None, msg))
        else:
            checks.append(("16. eext 隐私 (无邮箱/手机号)", ok, msg))

    # ---- 输出 ----
    if args.json:
        print(json.dumps([
            {"name": n, "ok": ok, "msg": msg}
            for (n, ok, msg) in checks
        ], ensure_ascii=False, indent=2))
    else:
        USE_COLOR = sys.stdout.isatty() and not args.no_color
        def colorize(s, code):
            return f"\033[{code}m{s}\033[0m" if USE_COLOR else s
        GREEN, RED, YELLOW, RESET = "32", "31", "33", "0"
        print(f"\n  JLCEDA Extension 校验: {ext_dir.name}\n")
        maxlen = max(len(n) for n, _, _ in checks)
        for name, ok, msg in checks:
            if ok is True:
                mark = colorize("✓", GREEN)
            elif ok is False:
                mark = colorize("✗", RED)
            else:
                mark = colorize("○", YELLOW)
            print(f"  {mark} {name.ljust(maxlen)}  {msg}")
        failed = [n for n, ok, _ in checks if ok is False]
        skipped = [n for n, ok, _ in checks if ok is None]
        passed = [n for n, ok, _ in checks if ok is True]
        print()
        print(f"  {colorize('PASS', GREEN)}: {len(passed)}  {colorize('FAIL', RED)}: {len(failed)}  {colorize('SKIP', YELLOW)}: {len(skipped)}")
        if failed:
            print(f"\n  {colorize('失败项', RED)}: {', '.join(failed)}")
            sys.exit(1)
        if skipped:
            print(f"  {colorize('跳过项 (建议补)', YELLOW)}: {', '.join(skipped)}")
        print()

    sys.exit(0)


if __name__ == "__main__":
    main()
