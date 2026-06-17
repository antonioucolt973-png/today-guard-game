import { _decorator, Button, Component, Label, Node } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('WaveIntermissionView')
export class WaveIntermissionView extends Component {
    @property(Node)
    public panel: Node | null = null;

    @property(Label)
    public completeLabel: Label | null = null;

    @property(Button)
    public nextWaveButton: Button | null = null;

    private _nextWaveHandler: (() => void) | null = null;

    protected onEnable(): void {
        this.nextWaveButton?.node.on(Button.EventType.CLICK, this.handleNextWaveClicked, this);
    }

    protected onDisable(): void {
        this.nextWaveButton?.node.off(Button.EventType.CLICK, this.handleNextWaveClicked, this);
    }

    public setNextWaveHandler(handler: (() => void) | null): void {
        this._nextWaveHandler = handler;
    }

    public show(currentWave: number): void {
        const message = `守住了第 ${currentWave} 波`;

        if (this.completeLabel) {
            this.completeLabel.string = message;
        }

        if (this.panel) {
            this.panel.active = true;
        } else {
            this.node.active = true;
        }
    }

    public hide(): void {
        if (this.panel) {
            this.panel.active = false;
        } else {
            this.node.active = false;
        }
    }

    private handleNextWaveClicked(): void {
        this._nextWaveHandler?.();
    }
}
