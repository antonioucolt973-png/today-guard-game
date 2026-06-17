import { Component, Node } from 'cc';

type ComponentType<T extends Component> = new (...args: any[]) => T;

function getComponentTypeName(componentType: unknown): string {
  if (!componentType) return 'null_or_undefined';
  return (componentType as any).name || String(componentType);
}

export function getExistingComponent<T extends Component>(
  node: Node | null | undefined,
  componentType: ComponentType<T> | null | undefined,
): T | null {
  if (!node) {
    console.warn('[ComponentLookup] getExistingComponent skipped: node is null/undefined.');
    return null;
  }

  if (!componentType) {
    console.warn(`[ComponentLookup] getExistingComponent skipped: componentType is null/undefined. node=${node.name}`);
    return null;
  }

  try {
    return node.getComponent(componentType) as T | null;
  } catch (error) {
    console.warn(
      `[ComponentLookup] getExistingComponent failed. node=${node.name}, type=${getComponentTypeName(componentType)}`,
      error
    );
    return null;
  }
}

export function getOrAddComponent<T extends Component>(
  node: Node | null | undefined,
  componentType: ComponentType<T> | null | undefined,
): T | null {
  if (!node) {
    console.warn('[ComponentLookup] getOrAddComponent skipped: node is null/undefined.');
    return null;
  }

  if (!componentType) {
    console.warn(`[ComponentLookup] getOrAddComponent skipped: componentType is null/undefined. node=${node.name}`);
    return null;
  }

  try {
    const existing = node.getComponent(componentType) as T | null;
    if (existing) return existing;

    return node.addComponent(componentType) as T;
  } catch (error) {
    console.warn(
      `[ComponentLookup] getOrAddComponent failed. node=${node.name}, type=${getComponentTypeName(componentType)}`,
      error
    );
    return null;
  }
}