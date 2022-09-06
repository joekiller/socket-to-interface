/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
type Thing =
  | {
      [key: string]: any | [any];
    }
  | any
  | [any];

export function deepCompareShapes(o1: Thing, o2: Thing): boolean {
  // Both nulls = same
  if (o1 === null && o2 === null) {
    return true;
  }

  // both arrays
  if (Array.isArray(o1) && Array.isArray(o2)) {
    const o1length = o1.length;
    const o2length = o2.length;
    if (o1length === o2length) {
      // return the double negative of some !sameKey
      return ![...Array(o1.length).keys()]
        .map((idx) => deepCompareShapes(o1[idx], o2[idx]))
        .some((sameKey) => !sameKey);
    } else {
      // reduce the objects to what they are and then compare
      let outer = new Set(o1);
      let inner = new Set(o2);
      const swap = inner.size > outer.size;
      if (swap) {
        const tmp = outer;
        outer = inner;
        inner = tmp;
      }
      const compareOuter = Array.from(outer).sort();
      const compareInner = Array.from(inner).sort();
      for (const idx of [...Array(compareOuter.length).keys()]) {
        for (const idx2 of [...Array(compareInner.length).keys()]) {
          if (!deepCompareShapes(compareOuter[idx], compareInner[idx2])) {
            return false;
          }
        }
      }
      return true;
    }
    // one is an array
  } else if (Array.isArray(o1) || Array.isArray(o2)) {
    return false;
  }

  const o1type = typeof o1;
  const o2type = typeof o2;
  // o1 and o2 are not array, and if they aren't objects just compare them
  if (o1type !== 'object' && o2type !== 'object') {
    return o1type === o2type;
  }

  // Get the keys of each object
  const o1keys = new Set<string>(Object.keys(o1));
  const o2keys = new Set<string>(Object.keys(o2));
  if (o1keys.size !== o2keys.size) {
    // Different number of own properties = not the same
    return false;
  }

  // Look for differences, using recursion as necessary
  for (const key of o1keys) {
    if (!o2keys.has(key)) {
      // Different keys
      return false;
    }

    // Get the values and their types
    const v1 = o1[key];
    const v2 = o2[key];
    const t1 = typeof v1;
    const t2 = typeof v2;
    if (t1 === 'object') {
      if (t2 === 'object') {
        return deepCompareShapes(v1, v2);
      } else {
        return false;
      }
    } else if (t2 === 'object') {
      // We know `v1` isn't an object
      return false;
    } else if (t1 !== t2) {
      return false;
    }
  }

  return true;
}

export type Shape =
  | {
      [key: string]: string | null | boolean | number | Shape[];
    }
  | string
  | null
  | boolean
  | number;

function detectElementType(type: string) {
  let entry = null;
  switch (type) {
    case 'undefined':
      entry = undefined;
      break;
    case 'boolean':
      entry = true;
      break;
    case 'number':
      entry = 0;
      break;
    case 'string':
      entry = '';
      break;
    case 'bigint':
      entry = 0;
      break;
  }
  return entry;
}

export function deepShape(thing: Thing): Shape {
  // Get the keys of each object
  const arrayThing = Array.isArray(thing);
  const shape: Thing = arrayThing ? [] : {};
  if (thing === null) {
    return null;
  }

  // inspect all keys to get shape
  for (const key of arrayThing ? thing.sort() : new Set<string>(Object.keys(thing))) {
    // Get the values and their types
    const value = arrayThing ? key : thing[key];
    if (Array.isArray(value)) {
      // we want to map all the values and see if any are objects otherwise make them ""
      const v1ArrayShape = new Set<Thing>();
      value.sort().forEach((element) => {
        if (Array.isArray(element) || typeof element === 'object') {
          const elementShape = deepShape(element);
          if (!Array.from(v1ArrayShape).some((e) => deepCompareShapes(e, elementShape))) {
            v1ArrayShape.add(elementShape);
          }
        } else {
          v1ArrayShape.add(detectElementType(typeof element));
        }
      });
      // then we reduce the set to just what is left of objects or a string
      shape[key] = Array.from(v1ArrayShape).sort();
    } else {
      // value is an object or primitive
      const type = typeof value;
      if (type === 'object') {
        const entry = deepShape(value);
        if (arrayThing && Array.isArray(shape) && !shape.some((e) => deepCompareShapes(e, entry))) {
          shape.push(entry);
        } else {
          shape[key] = deepShape(value);
        }
      } else {
        const entry = detectElementType(type);
        if (entry !== null) {
          if (arrayThing) {
            shape.push(entry);
          } else {
            shape[key] = entry;
          }
        }
      }
    }
  }

  // finished shaping
  return arrayThing ? shape.sort() : shape;
}
