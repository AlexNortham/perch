import { Bone, BoxGeometry, Float32BufferAttribute, Group, MeshLambertMaterial, Skeleton, SkinnedMesh } from 'three';
import { describe, expect, it } from 'vitest';
import { attachIdentity, updateIdentity } from './identity';

/** A minimal hero model: a group holding a skinned body, like a BirdRig. */
function model(): { root: Group; body: SkinnedMesh; material: MeshLambertMaterial } {
  const g = new BoxGeometry(1, 1, 1);
  const n = g.getAttribute('position').count;
  g.setAttribute('skinIndex', new Float32BufferAttribute(new Array(n * 4).fill(0), 4));
  g.setAttribute('skinWeight', new Float32BufferAttribute(new Array(n * 4).fill(0).map((_, i) => (i % 4 === 0 ? 1 : 0)), 4));
  const material = new MeshLambertMaterial();
  const body = new SkinnedMesh(g, material);
  const bone = new Bone();
  body.add(bone);
  body.bind(new Skeleton([bone]));
  const root = new Group();
  root.add(body);
  return { root, body, material };
}

describe('team identification (G18)', () => {
  it('outlines enemies, x-rays allies, and leaves the local bird alone', () => {
    const { root } = model();
    const id = attachIdentity(root);
    expect(id).not.toBeNull();
    if (!id) return;
    updateIdentity(id, 'enemy', false, true);
    expect([id.outlines[0]?.visible, id.xrays[0]?.visible]).toEqual([true, false]);
    updateIdentity(id, 'enemy', true, true);
    expect([id.outlines[0]?.visible, id.xrays[0]?.visible]).toEqual([true, true]);
    updateIdentity(id, 'ally', false, true);
    expect([id.outlines[0]?.visible, id.xrays[0]?.visible]).toEqual([false, true]);
    updateIdentity(id, 'self', false, true);
    expect([id.outlines[0]?.visible, id.xrays[0]?.visible]).toEqual([false, false]);
    updateIdentity(id, 'enemy', true, false);
    expect([id.outlines[0]?.visible, id.xrays[0]?.visible]).toEqual([false, false]);
  });

  it('shares the body geometry and skeleton, casts no shadows, and gives the body a rim-lit copy of its material', () => {
    const { root, body, material } = model();
    const id = attachIdentity(root);
    if (!id) throw new Error('no identity');
    for (const o of [...id.outlines, ...id.xrays]) {
      expect(o.geometry).toBe(body.geometry);
      expect(o.skeleton).toBe(body.skeleton);
      expect(o.castShadow).toBe(false);
    }
    expect(body.material).not.toBe(material);
    // A second model with the same original material shares the same rim copy (one shader program).
    const other = model();
    other.body.material = material;
    attachIdentity(other.root);
    expect(other.body.material).toBe(body.material);
    // X-rays draw after the world and before bodies.
    expect(id.xrays[0]?.renderOrder).toBeLessThan(body.renderOrder);
    // A material that already has the rim (the sculpted birds') is left alone.
    const own = model();
    own.material.name = 'bird-solid';
    attachIdentity(own.root);
    expect(own.body.material).toBe(own.material);
  });
});
