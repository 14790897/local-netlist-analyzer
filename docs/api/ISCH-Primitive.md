# ISCH_Primitive interface

```typescript
interface ISCH_Primitive {
    getState_PrimitiveType: () => ESCH_PrimitiveType;
    getState_PrimitiveId: () => string;
    create: () => ISCH_Primitive | Promise<ISCH_Primitive>;
    toAsync: () => ISCH_Primitive;
    toSync: () => ISCH_Primitive;
    isAsync: () => boolean;
    reset: () => ISCH_Primitive | Promise<ISCH_Primitive>;
    done: () => ISCH_Primitive | Promise<ISCH_Primitive>;
}
```

# ISCH_PrimitiveComponent class

```typescript
class ISCH_PrimitiveComponent implements ISCH_Primitive {
    // 坐标
    x: number;
    y: number;
    rotation: number;
    mirror: boolean;

    // 属性
    name?: string;
    designator?: string;
    primitiveId?: string;
    otherProperty?: { [key: string]: string | number | boolean };

    // 状态获取
    getState_Designator(): string;
    getState_Name(): string;
    getState_Manufacturer(): string;
    getState_ManufacturerId(): string;
    getState_Supplier(): string;
    getState_SupplierId(): string;
    getState_Footprint(): string;
    getState_UniqueId(): string;
    getState_Component(): string;
    getState_Symbol(): string;
    getState_Net(): string;
    getState_AddIntoBom(): boolean;
    getState_AddIntoPcb(): boolean;
    getState_Mirror(): boolean;
    getState_Rotation(): number;
    getState_X(): number;
    getState_Y(): number;

    // 引脚
    getAllPins(): Promise<ISCH_PrimitiveComponentPin[]>;
}
```

# ISCH_PrimitiveComponentPin class

```typescript
class ISCH_PrimitiveComponentPin extends ISCH_PrimitivePin {
    primitiveType: ESCH_PrimitiveType.COMPONENT_PIN;
    
    // 继承自 ISCH_PrimitivePin
    pinNumber: string;
    pinName: string;
    pinLength: number;
    pinShape: ESCH_PrimitivePinShape;
    pinType: ESCH_PrimitivePinType;
    pinColor: string | null;
}
```

# ESCH_PrimitiveType enum

```typescript
enum ESCH_PrimitiveType {
    ARC = "Arc",
    BUS = "Bus",
    CIRCLE = "Circle",
    COMPONENT = "Component",
    COMPONENT_PIN = "ComponentPin",
    PIN = "Pin",
    POLYGON = "Polygon",
    RECTANGLE = "Rectangle",
    TEXT = "Text",
    WIRE = "Wire",
    // ...
}
```

# ESYS_NetlistType enum

```typescript
enum ESYS_NetlistType {
    ALLEGRO = "Allegro",
    ALTIUM_DESIGNER = "Protel2",
    DISA = "DISA",
    DISA_SIMULATION = "DSNET",
    EASYEDA_PRO = "EasyEDA",
    JLCEDA_PRO = "JLCEDA",
    PADS = "PADS",
    PROTEL2 = "Protel2",
}
```
