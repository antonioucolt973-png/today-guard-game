import { _decorator, Color, Component, Graphics, Node, Sprite, SpriteFrame, UITransform, Vec3 } from 'cc';
import { ArtSpriteHelper } from './ArtSpriteHelper';
import { SfxController } from './SfxController';
import { getExistingComponent, getOrAddComponent } from './ComponentLookup';

const { ccclass, property } = _decorator;

type HomeBaseHealthLike = {
    isGameOver?: boolean;
    takeDamage?: (damage: number) => void;
};

@ccclass('BasicMonster')
export class BasicMonster extends Component {
    @property(Node)
    public target: Node | null = null;

    @property
    public moveSpeed = 120;

    @property
    public stopDistance = 18;

    @property
    public contactDamage = 10;

    @property
    public maxHp = 1;

    @property
    public currentHp = 1;

    @property
    public size = 72;

    @property(Color)
    public color = new Color(210, 78, 68, 255);

    @property
    public artPath = '';

    @property(SpriteFrame)
    public monsterSpriteFrame: SpriteFrame | null = null;

    private readonly _targetWorldPosition = new Vec3();
    private readonly _currentWorldPosition = new Vec3();
    private readonly _nextWorldPosition = new Vec3();
    private readonly _direction = new Vec3();
    private _stopped = false;
    private _defeated = false;

    public setup(
        target: Node,
        moveSpeed: number,
        size: number,
        color: Color,
        contactDamage = 10,
        maxHp = 1,
        artPath = '',
        monsterSpriteFrame: SpriteFrame | null = null,
    ): void {
        this.target = target;
        this.moveSpeed = moveSpeed;
        this.size = size;
        this.color = color.clone();
        this.contactDamage = contactDamage;
        this.maxHp = Math.max(1, Math.floor(maxHp));
        this.currentHp = this.maxHp;
        this.artPath = artPath;
        this.monsterSpriteFrame = monsterSpriteFrame;
        this.drawPlaceholder();
    }

    public takeDamage(damage: number): boolean {
        if (this._stopped || this._defeated || damage <= 0) {
            return false;
        }

        this.currentHp = Math.max(0, this.currentHp - Math.floor(damage));
        this.drawPlaceholder();

        if (this.currentHp <= 0) {
            return this.markDefeated();
        }

        return false;
    }

    private markDefeated(): boolean {
        if (this._stopped || this._defeated) {
            return false;
        }

        this._defeated = true;
        this._stopped = true;
        SfxController.playSfx(this.node, 'kill');
        this.node.destroy();
        return true;
    }

    protected onLoad(): void {
        this.drawPlaceholder();
    }

    protected update(deltaTime: number): void {
        if (this._stopped || !this.target || deltaTime <= 0) {
            return;
        }

        this.keepVisualVisible();

        const targetHealth = this.findHomeBaseHealth(this.target);
        if (targetHealth?.isGameOver) {
            this._stopped = true;
            this.node.destroy();
            return;
        }

        this.node.getWorldPosition(this._currentWorldPosition);
        this.target.getWorldPosition(this._targetWorldPosition);

        Vec3.subtract(this._direction, this._targetWorldPosition, this._currentWorldPosition);
        const distance = this._direction.length();

        if (distance <= this.stopDistance) {
            this._stopped = true;
            targetHealth?.takeDamage(this.contactDamage);
            this.node.destroy();
            return;
        }

        this._direction.multiplyScalar(1 / distance);
        Vec3.scaleAndAdd(
            this._nextWorldPosition,
            this._currentWorldPosition,
            this._direction,
            this.moveSpeed * deltaTime,
        );
        this.node.setWorldPosition(this._nextWorldPosition);
    }

    private drawPlaceholder(): void {
        this.ensureVisible();

        const transform = getOrAddComponent(this.node, UITransform);
        transform.setContentSize(this.size, this.size);

        const graphics = getOrAddComponent(this.node, Graphics);
        graphics.enabled = true;
        graphics.clear();
        graphics.fillColor = this.color;
        graphics.rect(-this.size * 0.5, -this.size * 0.5, this.size, this.size);
        graphics.fill();

        if (this.maxHp > 1) {
            const hpRate = Math.max(0, Math.min(1, this.currentHp / this.maxHp));
            graphics.fillColor = new Color(30, 220, 120, 255);
            graphics.rect(-this.size * 0.5, this.size * 0.58, this.size * hpRate, 4);
            graphics.fill();
        }

        if (this.monsterSpriteFrame) {
            this.applyConfiguredSpriteFrame();
            return;
        }

        if (this.artPath) {
            ArtSpriteHelper.applySprite(this.node, this.artPath, this.size, this.size);
        }
    }

    private applyConfiguredSpriteFrame(): void {
        const transform = getOrAddComponent(this.node, UITransform);
        transform.setContentSize(this.size, this.size);

        const sprite = getOrAddComponent(this.node, Sprite);
        sprite.spriteFrame = this.monsterSpriteFrame;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.enabled = true;

        const graphics = getExistingComponent(this.node, Graphics);
        if (graphics) {
            graphics.enabled = false;
        }
    }

    private ensureVisible(): void {
        this.node.active = true;

        const scale = this.node.scale;
        if (scale.x === 0 || scale.y === 0 || scale.z === 0) {
            this.node.setScale(scale.x === 0 ? 1 : scale.x, scale.y === 0 ? 1 : scale.y, scale.z === 0 ? 1 : scale.z);
        }
    }

    private keepVisualVisible(): void {
        this.ensureVisible();
        const graphics = getExistingComponent(this.node, Graphics);
        if (this.monsterSpriteFrame) {
            const sprite = getExistingComponent(this.node, Sprite);
            if (sprite) {
                sprite.enabled = true;
            }
            if (graphics) {
                graphics.enabled = false;
            }
            return;
        }

        if (graphics) {
            graphics.enabled = true;
        }
    }

    private findHomeBaseHealth(node: Node): HomeBaseHealthLike | null {
        for (const component of node.components) {
            const candidate = component as unknown as HomeBaseHealthLike;
            if (typeof candidate.takeDamage === 'function' || typeof candidate.isGameOver === 'boolean') {
                return candidate;
            }
        }

        return null;
    }
}
