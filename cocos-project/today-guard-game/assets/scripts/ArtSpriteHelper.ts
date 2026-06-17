import { Graphics, Node, resources, Sprite, SpriteFrame, UITransform } from 'cc';
import { getExistingComponent, getOrAddComponent } from './ComponentLookup';

export class ArtSpriteHelper {
    public static applySprite(node: Node, resourcePath: string, width: number, height: number, disableGraphics = true): void {
        const transform = getOrAddComponent(node, UITransform);
        transform.setContentSize(width, height);

        const sprite = getOrAddComponent(node, Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.enabled = true;
        this.ensureNodeVisible(node);

        resources.load(`${resourcePath}/spriteFrame`, SpriteFrame, (error, spriteFrame) => {
            if (error || !spriteFrame || !node.isValid) {
                const graphics = getExistingComponent(node, Graphics);
                if (graphics) {
                    graphics.enabled = true;
                }
                console.warn(`[ArtSpriteHelper] keep graphics fallback, sprite load failed path=${resourcePath}`, error);
                return;
            }

            sprite.spriteFrame = spriteFrame;
            sprite.enabled = true;
            const graphics = getExistingComponent(node, Graphics);
            if (disableGraphics) {
                if (graphics) {
                    graphics.enabled = false;
                }
            } else if (graphics) {
                graphics.enabled = true;
            }
            this.ensureNodeVisible(node);
        });
    }

    public static applyBackground(parent: Node, childName: string, resourcePath: string, width: number, height: number): Node {
        let background = parent.getChildByName(childName);
        if (!background) {
            background = new Node(childName);
            background.layer = parent.layer;
            parent.addChild(background);
        }

        background.setPosition(0, 0, 0);
        background.setSiblingIndex(0);
        this.applySprite(background, resourcePath, width, height);
        return background;
    }

    public static applyFullscreenBackground(parent: Node, childName: string, resourcePath: string): Node {
        const size = this.getReferenceSize(parent);
        const transform = getOrAddComponent(parent, UITransform);
        transform.setContentSize(size.width, size.height);
        return this.applyBackground(parent, childName, resourcePath, size.width, size.height);
    }

    public static getReferenceSize(node: Node): { width: number; height: number } {
        const canvas = this.findAncestorByName(node, 'Canvas');
        const canvasTransform = getExistingComponent(canvas, UITransform);
        if (canvasTransform) {
            return {
                width: Math.max(canvasTransform.width, 960),
                height: Math.max(canvasTransform.height, 640),
            };
        }

        const parentTransform = getExistingComponent(node.parent, UITransform);
        if (parentTransform) {
            return {
                width: Math.max(parentTransform.width, 960),
                height: Math.max(parentTransform.height, 640),
            };
        }

        const transform = getExistingComponent(node, UITransform);
        return {
            width: Math.max(transform?.width ?? 1280, 960),
            height: Math.max(transform?.height ?? 720, 640),
        };
    }

    private static findAncestorByName(node: Node | null, name: string): Node | null {
        let current: Node | null = node;
        while (current) {
            if (current.name === name) {
                return current;
            }
            current = current.parent;
        }
        return null;
    }

    private static ensureNodeVisible(node: Node): void {
        node.active = true;

        const scale = node.scale;
        if (scale.x === 0 || scale.y === 0 || scale.z === 0) {
            node.setScale(scale.x === 0 ? 1 : scale.x, scale.y === 0 ? 1 : scale.y, scale.z === 0 ? 1 : scale.z);
        }

    }

}
