import { describe, expect, it } from 'vitest';
import { moveInOrder } from './gallery-order';

const ids = ['a', 'b', 'c', 'd'];

describe('moveInOrder', () => {
  it('moves a photo up, down, to the top and to the bottom', () => {
    expect(moveInOrder(ids, 'c', 'up')).toEqual(['a', 'c', 'b', 'd']);
    expect(moveInOrder(ids, 'b', 'down')).toEqual(['a', 'c', 'b', 'd']);
    expect(moveInOrder(ids, 'd', 'top')).toEqual(['d', 'a', 'b', 'c']);
    expect(moveInOrder(ids, 'a', 'bottom')).toEqual(['b', 'c', 'd', 'a']);
  });

  it('moves to a 1-based position and keeps it inside the list', () => {
    expect(moveInOrder(ids, 'a', 3)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveInOrder(ids, 'd', 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(moveInOrder(ids, 'a', 99)).toEqual(['b', 'c', 'd', 'a']);
  });

  it('does nothing past either end or for an unknown photo', () => {
    expect(moveInOrder(ids, 'a', 'up')).toEqual(ids);
    expect(moveInOrder(ids, 'd', 'down')).toEqual(ids);
    expect(moveInOrder(ids, 'zz', 'top')).toEqual(ids);
  });
});
