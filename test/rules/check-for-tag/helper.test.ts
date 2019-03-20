/** do not DoNotUse */
export function other(num: number);

export function other(_num?: number) {}

/** @DoNotUse */
export let other2: Function;

/** @DoNotUse */
export class DeprecatedClass {
    constructor() {}
}

export class PartiallyDeprecatedClass {
    /** @DoNotUse */
    public hello(foo: number) {
    }

    public world(foo: number) {
    }
}