import { _decorator, Button, Color, Component, Graphics, Label, Node, UITransform, Vec2 } from 'cc';
import { FeedbackController } from './FeedbackController';
import { GameState } from './GameState';
import { SkillChoice, SkillEffectController } from './SkillEffectController';
import { getOrAddComponent } from './ComponentLookup';

const { ccclass, property } = _decorator;

@ccclass('SkillChoiceView')
export class SkillChoiceView extends Component {
    @property(Node)
    public panel: Node | null = null;

    @property(Label)
    public completeLabel: Label | null = null;

    @property(Label)
    public titleLabel: Label | null = null;

    @property(Button)
    public skillButton1: Button | null = null;

    @property(Button)
    public skillButton2: Button | null = null;

    @property(Button)
    public skillButton3: Button | null = null;

    @property(Label)
    public skillLabel1: Label | null = null;

    @property(Label)
    public skillLabel2: Label | null = null;

    @property(Label)
    public skillLabel3: Label | null = null;

    @property(Label)
    public feedbackLabel: Label | null = null;

    @property(SkillEffectController)
    public skillEffectController: SkillEffectController | null = null;

    private _currentChoices: SkillChoice[] = [];
    private _choiceHandler: ((choiceName: string) => void) | null = null;
    private _canChoose = false;
    private _lastChoiceName = '';

    public get lastChoiceName(): string {
        return this._lastChoiceName;
    }

    protected onEnable(): void {
        this.skillButton1?.node.on(Button.EventType.CLICK, this.handleSkill1Clicked, this);
        this.skillButton2?.node.on(Button.EventType.CLICK, this.handleSkill2Clicked, this);
        this.skillButton3?.node.on(Button.EventType.CLICK, this.handleSkill3Clicked, this);
    }

    protected onDisable(): void {
        this.skillButton1?.node.off(Button.EventType.CLICK, this.handleSkill1Clicked, this);
        this.skillButton2?.node.off(Button.EventType.CLICK, this.handleSkill2Clicked, this);
        this.skillButton3?.node.off(Button.EventType.CLICK, this.handleSkill3Clicked, this);
    }

    public setChoiceHandler(handler: ((choiceName: string) => void) | null): void {
        this._choiceHandler = handler;
    }

    public show(currentWave: number): void {
        this._canChoose = true;
        GameState.isSkillTriggered = true;
        GameState.destroyAllBullets(this.findBulletLayer());
        this.getSkillEffectController()?.clearTemporaryEffects();
        this.refreshRandomChoices();
        this.applyReadableLayout();
        this.updateText(currentWave);
        this.setButtonsInteractable(true);
        this.hideLegacyNextWaveButton();

        const targetPanel = this.getPanel();
        targetPanel.active = true;
    }

    public hide(): void {
        this._canChoose = false;
        GameState.isSkillTriggered = false;
        this.setButtonsInteractable(false);

        const targetPanel = this.getPanel();
        targetPanel.active = false;
    }

    private updateText(currentWave: number): void {
        if (this.completeLabel) {
            this.completeLabel.string = `守住了第 ${currentWave} 波`;
        }

        if (this.titleLabel) {
            this.titleLabel.string = '选一个办法撑下去';
        }

        const labels = [this.skillLabel1, this.skillLabel2, this.skillLabel3];
        const buttons = [this.skillButton1, this.skillButton2, this.skillButton3];
        labels.forEach((label, index) => {
            const choice = this._currentChoices[index];
            if (label && choice) {
                this.setSkillCardText(buttons[index], label, choice);
            }
        });

        if (this.feedbackLabel) {
            this.feedbackLabel.string = '';
        }
    }

    private applyReadableLayout(): void {
        const panel = this.getPanel();
        this.setNodeSize(panel, 620, 480);
        this.drawPanelBackdrop(panel);
        this.drawHeaderBackdrop(panel);

        if (this.completeLabel) {
            this.setTitleLabelLayout(this.completeLabel, 500, 42, 28, 34);
            this.completeLabel.node.setPosition(0, 164, 0);
        }

        if (this.titleLabel) {
            this.setTitleLabelLayout(this.titleLabel, 500, 32, 21, 28);
            this.titleLabel.node.setPosition(0, 124, 0);
        }

        this.layoutSkillButton(this.skillButton1, this.skillLabel1, 38);
        this.layoutSkillButton(this.skillButton2, this.skillLabel2, -66);
        this.layoutSkillButton(this.skillButton3, this.skillLabel3, -170);

        if (this.feedbackLabel) {
            this.setLabelLayout(this.feedbackLabel, 480, 28, 18, 24);
            this.feedbackLabel.node.setPosition(0, -228, 0);
            this.feedbackLabel.color = new Color(255, 245, 220, 255);
        }
    }

    private layoutSkillButton(button: Button | null, label: Label | null, y: number): void {
        if (button) {
            this.setNodeSize(button.node, 520, 86);
            button.node.setPosition(0, y, 0);
            button.node.active = true;
            this.drawSkillCard(button.node);
        }

        if (label) {
            this.setSkillNameLabelLayout(label, 470, 30, 23, 29);
            label.node.setPosition(0, 16, 0);
            label.node.active = true;
        }
    }

    private setLabelLayout(label: Label, width: number, height: number, fontSize: number, lineHeight: number): void {
        this.setNodeSize(label.node, width, height);
        label.fontSize = fontSize;
        label.lineHeight = lineHeight;
    }

    private setNodeSize(node: Node, width: number, height: number): void {
        const transform = getOrAddComponent(node, UITransform);
        transform.setContentSize(width, height);
    }

    private drawPanelBackdrop(panel: Node): void {
        let backdrop = panel.getChildByName('SkillChoiceBackdrop');
        if (!backdrop) {
            backdrop = new Node('SkillChoiceBackdrop');
            backdrop.layer = panel.layer;
            panel.addChild(backdrop);
        }

        backdrop.setPosition(0, -6, 0);
        backdrop.setSiblingIndex(0);
        this.setNodeSize(backdrop, 620, 480);

        const graphics = getOrAddComponent(backdrop, Graphics);
        graphics.clear();
        graphics.fillColor = new Color(14, 18, 28, 218);
        graphics.roundRect(-310, -240, 620, 480, 20);
        graphics.fill();
        graphics.strokeColor = new Color(255, 255, 255, 38);
        graphics.lineWidth = 2;
        graphics.roundRect(-310, -240, 620, 480, 20);
        graphics.stroke();
    }

    private drawHeaderBackdrop(panel: Node): void {
        let backdrop = panel.getChildByName('SkillChoiceHeaderBackdrop');
        if (!backdrop) {
            backdrop = new Node('SkillChoiceHeaderBackdrop');
            backdrop.layer = panel.layer;
            panel.addChild(backdrop);
        }

        backdrop.setPosition(0, 144, 0);
        backdrop.setSiblingIndex(1);
        this.setNodeSize(backdrop, 540, 86);

        const graphics = getOrAddComponent(backdrop, Graphics);
        graphics.clear();
        graphics.fillColor = new Color(20, 28, 44, 230);
        graphics.roundRect(-270, -43, 540, 86, 14);
        graphics.fill();
    }

    private drawSkillCard(buttonNode: Node): void {
        let card = buttonNode.getChildByName('SkillCardBackground');
        if (!card) {
            card = new Node('SkillCardBackground');
            card.layer = buttonNode.layer;
            buttonNode.addChild(card);
        }

        card.setPosition(0, 0, 0);
        card.setSiblingIndex(0);
        this.setNodeSize(card, 520, 86);

        const graphics = getOrAddComponent(card, Graphics);
        graphics.clear();
        graphics.fillColor = new Color(248, 241, 224, 248);
        graphics.roundRect(-260, -43, 520, 86, 12);
        graphics.fill();
        graphics.strokeColor = new Color(98, 78, 48, 120);
        graphics.lineWidth = 2;
        graphics.roundRect(-260, -43, 520, 86, 12);
        graphics.stroke();
    }

    private setSkillCardText(button: Button | null, nameLabel: Label, choice: SkillChoice): void {
        nameLabel.string = choice.name;
        const descLabel = this.getOrCreateDescriptionLabel(button?.node ?? null);
        if (descLabel) {
            descLabel.string = choice.description;
        }
    }

    private getOrCreateDescriptionLabel(buttonNode: Node | null): Label | null {
        if (!buttonNode) {
            return null;
        }

        let descNode = buttonNode.getChildByName('DescriptionLabel');
        if (!descNode) {
            descNode = new Node('DescriptionLabel');
            descNode.layer = buttonNode.layer;
            buttonNode.addChild(descNode);
        }

        descNode.setPosition(0, -18, 0);
        descNode.setSiblingIndex((descNode.parent?.children.length ?? 1) - 1);
        this.setNodeSize(descNode, 470, 34);

        const label = getOrAddComponent(descNode, Label);
        this.setSkillDescriptionLabelLayout(label, 470, 34, 17, 22);
        return label;
    }

    private setTitleLabelLayout(label: Label, width: number, height: number, fontSize: number, lineHeight: number): void {
        this.setLabelLayout(label, width, height, fontSize, lineHeight);
        label.color = new Color(255, 252, 236, 255);
        this.applyReadableTextEffects(label);
        label.node.setSiblingIndex((label.node.parent?.children.length ?? 1) - 1);
    }

    private setSkillNameLabelLayout(label: Label, width: number, height: number, fontSize: number, lineHeight: number): void {
        this.setLabelLayout(label, width, height, fontSize, lineHeight);
        label.color = new Color(48, 34, 22, 255);
        label.overflow = Label.Overflow.SHRINK;
        label.enableWrapText = false;
        label.node.setSiblingIndex((label.node.parent?.children.length ?? 1) - 1);
    }

    private setSkillDescriptionLabelLayout(label: Label, width: number, height: number, fontSize: number, lineHeight: number): void {
        this.setLabelLayout(label, width, height, fontSize, lineHeight);
        label.color = new Color(92, 72, 54, 255);
        label.overflow = Label.Overflow.SHRINK;
        label.enableWrapText = false;
    }

    private applyReadableTextEffects(label: Label): void {
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
        styledLabel.shadowColor = new Color(0, 0, 0, 170);
        styledLabel.shadowOffset = new Vec2(2, -2);
        styledLabel.shadowBlur = 2;
    }

    private choose(index: number): void {
        if (!this._canChoose) {
            return;
        }

        const choice = this._currentChoices[index];
        if (!choice) {
            return;
        }

        this._canChoose = false;
        this._lastChoiceName = choice.name;
        this.setButtonsInteractable(false);
        FeedbackController.getForNode(this.node)?.playSkillFeedback(this.getChoiceButtonNode(index));
        this.getSkillEffectController()?.applySkill(choice.id);

        if (this.feedbackLabel) {
            this.feedbackLabel.string = `已选择：${choice.name}`;
        }

        this.hide();
        this._choiceHandler?.(choice.name);
    }

    private setButtonsInteractable(interactable: boolean): void {
        const buttons = [this.skillButton1, this.skillButton2, this.skillButton3];
        for (const button of buttons) {
            if (button) {
                button.interactable = interactable;
            }
        }
    }

    private getSkillEffectController(): SkillEffectController | null {
        if (this.skillEffectController) {
            return this.skillEffectController;
        }

        this.skillEffectController = this.findSkillEffectController() ?? this.node.addComponent(SkillEffectController);
        return this.skillEffectController;
    }

    private findSkillEffectController(): SkillEffectController | null {
        for (const component of this.node.components) {
            const candidate = component as Component & Record<string, unknown>;
            if (
                typeof candidate.applySkill === 'function'
                && typeof candidate.getRandomSkillChoices === 'function'
            ) {
                return component as SkillEffectController;
            }
        }

        return null;
    }

    private refreshRandomChoices(): void {
        const skillEffectController = this.getSkillEffectController();
        this._currentChoices = skillEffectController?.getRandomSkillChoices(3) ?? [];
    }

    private hideLegacyNextWaveButton(): void {
        const legacyButton = this.getPanel().getChildByName('NextWaveButton');
        if (legacyButton) {
            legacyButton.active = false;
        }
    }

    private getPanel(): Node {
        return this.panel ?? this.node;
    }

    private handleSkill1Clicked(): void {
        this.choose(0);
    }

    private handleSkill2Clicked(): void {
        this.choose(1);
    }

    private handleSkill3Clicked(): void {
        this.choose(2);
    }

    private getChoiceButtonNode(index: number): Node | null {
        const buttons = [this.skillButton1, this.skillButton2, this.skillButton3];
        return buttons[index]?.node ?? null;
    }

    private findBulletLayer(): Node | null {
        const canvas = this.findAncestorByName(this.node, 'Canvas');
        const battleLayer = canvas?.getChildByName('BattleLayer') ?? null;
        return battleLayer?.getChildByName('BulletLayer') ?? null;
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
