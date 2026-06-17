import { _decorator, Color, Component, Graphics, Label, Node, UITransform, Vec2 } from 'cc';
import { SfxController } from './SfxController';
import { getExistingComponent, getOrAddComponent } from './ComponentLookup';

const { ccclass, property } = _decorator;

@ccclass('BattleStats')
export class BattleStats extends Component {
    @property(Label)
    public killLabel: Label | null = null;

    @property
    public hudBarHeight = 70;

    @property
    public hudBarTopMargin = 18;

    private _killCount = 0;

    public get killCount(): number {
        return this._killCount;
    }

    protected onLoad(): void {
        this.setupHudLayout();
        this.updateKillLabel();
    }

    public addKill(): void {
        this._killCount += 1;
        this.playComboSfx();
        this.updateKillLabel();
    }

    public reset(): void {
        this._killCount = 0;
        this.updateKillLabel();
    }

    private updateKillLabel(): void {
        const text = `已击退 ${this._killCount} 个情绪怪`;

        if (this.killLabel) {
            this.killLabel.string = text;
            return;
        }

        console.log(`[BattleStats] ${text}`);
    }

    private playComboSfx(): void {
        if (this._killCount === 3) {
            SfxController.playSfx(this.node, 'combo_3');
            return;
        }

        if (this._killCount === 5) {
            SfxController.playSfx(this.node, 'combo_5');
            return;
        }

        if (this._killCount === 10) {
            SfxController.playSfx(this.node, 'combo_10');
        }
    }

    private setupHudLayout(): void {
        const canvasSize = this.getCanvasSize();
        const barWidth = Math.max(720, canvasSize.width - 96);
        const barY = canvasSize.height * 0.5 - this.hudBarTopMargin - this.hudBarHeight * 0.5;

        const hudTransform = getOrAddComponent(this.node, UITransform);
        hudTransform.setContentSize(canvasSize.width, canvasSize.height);

        const bar = this.getOrCreateHudBar();
        bar.setPosition(0, barY, 0);
        bar.setSiblingIndex(0);

        const barTransform = getOrAddComponent(bar, UITransform);
        barTransform.setContentSize(barWidth, this.hudBarHeight);

        const graphics = getOrAddComponent(bar, Graphics);
        graphics.clear();
        graphics.fillColor = new Color(16, 22, 32, 205);
        graphics.roundRect(-barWidth * 0.5, -this.hudBarHeight * 0.5, barWidth, this.hudBarHeight, 14);
        graphics.fill();

        this.layoutLabel(this.node.getChildByName('HpLabel'), -barWidth * 0.31, barY, barWidth * 0.28, 44, 22);
        this.layoutLabel(this.killLabel?.node ?? this.node.getChildByName('KillLabel'), 0, barY, barWidth * 0.34, 44, 22);
        this.layoutLabel(this.node.getChildByName('WaveLabel'), barWidth * 0.31, barY, barWidth * 0.22, 44, 22);

    }

    private getOrCreateHudBar(): Node {
        let bar = this.node.getChildByName('HudBar');
        if (!bar) {
            bar = new Node('HudBar');
            bar.layer = this.node.layer;
            this.node.addChild(bar);
        }

        bar.active = true;
        return bar;
    }

    private layoutLabel(node: Node | null, x: number, y: number, width: number, height: number, fontSize: number): void {
        if (!node) {
            return;
        }

        node.active = true;
        node.setPosition(x, y, 0);
        node.setSiblingIndex((node.parent?.children.length ?? 1) - 1);

        const transform = getOrAddComponent(node, UITransform);
        transform.setContentSize(width, height);

        const label = getExistingComponent(node, Label);
        if (!label) {
            return;
        }

        label.fontSize = fontSize;
        label.lineHeight = 30;
        label.color = new Color(255, 255, 255, 255);
        label.horizontalAlign = 1;
        label.verticalAlign = 1;
        label.overflow = Label.Overflow.SHRINK;
        label.enableWrapText = false;

        const styledLabel = label as Label & {
            enableOutline?: boolean;
            outlineColor?: Color;
            outlineWidth?: number;
            enableShadow?: boolean;
            shadowColor?: Color;
            shadowOffset?: Vec2;
            shadowBlur?: number;
        };
        styledLabel.enableOutline = true;
        styledLabel.outlineColor = new Color(0, 0, 0, 220);
        styledLabel.outlineWidth = 2;
        styledLabel.enableShadow = true;
        styledLabel.shadowColor = new Color(0, 0, 0, 180);
        styledLabel.shadowOffset = new Vec2(2, -2);
        styledLabel.shadowBlur = 2;
    }

    private getCanvasSize(): { width: number; height: number } {
        const canvas = this.findAncestorByName(this.node, 'Canvas');
        const canvasTransform = getExistingComponent(canvas, UITransform);
        if (canvasTransform) {
            return {
                width: Math.max(canvasTransform.width, 960),
                height: Math.max(canvasTransform.height, 640),
            };
        }

        return { width: 1280, height: 720 };
    }

    private findAncestorByName(node: Node | null, name: string): Node | null {
        let current: Node | null = node;
        while (current) {
            if (current.name === name) {
                return current;
            }
            current = current.parent;
        }
        return null;
    }
}
