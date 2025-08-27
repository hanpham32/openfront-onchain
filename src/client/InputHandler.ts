import { EventBus, GameEvent } from "../core/EventBus";
import { ReplaySpeedMultiplier } from "./utilities/ReplaySpeedMultiplier";
import { UnitType } from "../core/game/Game";
import { UnitView } from "../core/game/GameView";
import { UserSettings } from "../core/game/UserSettings";

export class MouseUpEvent implements GameEvent {
  constructor(
    public readonly x: number,
    public readonly y: number,
  ) {}
}

export class MouseOverEvent implements GameEvent {
  constructor(
    public readonly x: number,
    public readonly y: number,
  ) {}
}

/**
 * Event emitted when a unit is selected or deselected
 */
export class UnitSelectionEvent implements GameEvent {
  constructor(
    public readonly unit: UnitView | null,
    public readonly isSelected: boolean,
  ) {}
}

export class MouseDownEvent implements GameEvent {
  constructor(
    public readonly x: number,
    public readonly y: number,
  ) {}
}

export class MouseMoveEvent implements GameEvent {
  constructor(
    public readonly x: number,
    public readonly y: number,
  ) {}
}

export class ContextMenuEvent implements GameEvent {
  constructor(
    public readonly x: number,
    public readonly y: number,
  ) {}
}

export class ZoomEvent implements GameEvent {
  constructor(
    public readonly x: number,
    public readonly y: number,
    public readonly delta: number,
  ) {}
}

export class DragEvent implements GameEvent {
  constructor(
    public readonly deltaX: number,
    public readonly deltaY: number,
  ) {}
}

export class AlternateViewEvent implements GameEvent {
  constructor(public readonly alternateView: boolean) {}
}

export class CloseViewEvent implements GameEvent {}

export class RedrawGraphicsEvent implements GameEvent {}

export class TogglePerformanceOverlayEvent implements GameEvent {}

export class ToggleStructureEvent implements GameEvent {
  constructor(public readonly structureType: UnitType | null) {}
}

export class ShowBuildMenuEvent implements GameEvent {
  constructor(
    public readonly x: number,
    public readonly y: number,
  ) {}
}
export class ShowEmojiMenuEvent implements GameEvent {
  constructor(
    public readonly x: number,
    public readonly y: number,
  ) {}
}

export class DoBoatAttackEvent implements GameEvent {}

export class DoGroundAttackEvent implements GameEvent {}

export class AttackRatioEvent implements GameEvent {
  constructor(public readonly attackRatio: number) {}
}

export class ReplaySpeedChangeEvent implements GameEvent {
  constructor(public readonly replaySpeedMultiplier: ReplaySpeedMultiplier) {}
}

export class CenterCameraEvent implements GameEvent {
  constructor() {}
}

export class AutoUpgradeEvent implements GameEvent {
  constructor(
    public readonly x: number,
    public readonly y: number,
  ) {}
}

export class InputHandler {
  private lastPointerX = 0;
  private lastPointerY = 0;

  private lastPointerDownX = 0;
  private lastPointerDownY = 0;

  private readonly pointers: Map<number, PointerEvent> = new Map();

  private lastPinchDistance = 0;

  private pointerDown = false;

  private alternateView = false;

  private moveInterval: ReturnType<typeof setTimeout> | null = null;
  private readonly activeKeys = new Set<string>();
  private keybinds: Record<string, string> = {};

  private readonly PAN_SPEED = 5;
  private readonly ZOOM_SPEED = 10;

  private readonly userSettings: UserSettings = new UserSettings();

  // Initialization guard to avoid duplicate listeners
  private isInitialized = false;

  // Stored listeners for clean teardown
  private pointerDownListener?: (e: PointerEvent) => void;
  private pointerUpListener?: (e: PointerEvent) => void;
  private wheelListener?: (e: WheelEvent) => void;
  private pointerMoveWindowListener?: (e: PointerEvent) => void;
  private contextMenuListener?: (e: MouseEvent) => void;
  private mouseMoveWindowListener?: (e: MouseEvent) => void;
  private touchStartListener?: (e: TouchEvent) => void;
  private touchMoveListener?: (e: TouchEvent) => void;
  private touchEndListener?: (e: TouchEvent) => void;
  private keydownListener?: (e: KeyboardEvent) => void;
  private keyupListener?: (e: KeyboardEvent) => void;

  private isEditableTarget(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement | null;
    const active = (document.activeElement as HTMLElement | null) ?? null;

    const isEditable = (el: HTMLElement | null) => {
      if (!el) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (el.isContentEditable) return true;
      return false;
    };

    if (isEditable(target)) return true;
    if (isEditable(active)) return true;
    return false;
  }

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly eventBus: EventBus,
  ) {}

  initialize() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    this.keybinds = {
      toggleView: "Space",
      centerCamera: "KeyC",
      moveUp: "KeyW",
      moveDown: "KeyS",
      moveLeft: "KeyA",
      moveRight: "KeyD",
      zoomOut: "KeyQ",
      zoomIn: "KeyE",
      attackRatioDown: "Digit1",
      attackRatioUp: "Digit2",
      boatAttack: "KeyB",
      groundAttack: "KeyG",
      modifierKey: "ControlLeft",
      altKey: "AltLeft",
      ...(JSON.parse(localStorage.getItem("settings.keybinds") ?? "{}") ?? {}),
    };

    // Mac users might have different keybinds
    const isMac = navigator.userAgent.includes("Mac");
    if (isMac) {
      this.keybinds.modifierKey = "MetaLeft"; // Use Command key on Mac
    }

    this.pointerDownListener = (e: PointerEvent) => this.onPointerDown(e);
    this.pointerUpListener = (e: PointerEvent) => this.onPointerUp(e);
    this.wheelListener = (e: WheelEvent) => {
      this.onScroll(e);
      this.onShiftScroll(e);
      this.onTrackpadPan(e);
      e.preventDefault();
    };
    this.pointerMoveWindowListener = (e: PointerEvent) => this.onPointerMove(e);
    this.contextMenuListener = (e: MouseEvent) => this.onContextMenu(e);
    this.mouseMoveWindowListener = (e: MouseEvent) => {
      if (e.movementX || e.movementY) {
        this.eventBus.emit(new MouseMoveEvent(e.clientX, e.clientY));
      }
    };
    this.touchStartListener = (e: TouchEvent) => this.onTouchStart(e);
    this.touchMoveListener = (e: TouchEvent) => this.onTouchMove(e);
    this.touchEndListener = (e: TouchEvent) => this.onTouchEnd(e);

    this.canvas.addEventListener("pointerdown", this.pointerDownListener);
    window.addEventListener("pointerup", this.pointerUpListener);
    this.canvas.addEventListener("wheel", this.wheelListener, {
      passive: false,
    });
    window.addEventListener("pointermove", this.pointerMoveWindowListener);
    this.canvas.addEventListener("contextmenu", this.contextMenuListener);
    window.addEventListener("mousemove", this.mouseMoveWindowListener);

    this.canvas.addEventListener("touchstart", this.touchStartListener, {
      passive: false,
    });
    this.canvas.addEventListener("touchmove", this.touchMoveListener, {
      passive: false,
    });
    this.canvas.addEventListener("touchend", this.touchEndListener, {
      passive: false,
    });
    this.pointers.clear();

    this.moveInterval = setInterval(() => {
      let deltaX = 0;
      let deltaY = 0;

      // Skip if shift is held down
      if (
        this.activeKeys.has("ShiftLeft") ||
        this.activeKeys.has("ShiftRight")
      ) {
        return;
      }

      if (
        this.activeKeys.has(this.keybinds.moveUp) ||
        this.activeKeys.has("ArrowUp")
      )
        deltaY += this.PAN_SPEED;
      if (
        this.activeKeys.has(this.keybinds.moveDown) ||
        this.activeKeys.has("ArrowDown")
      )
        deltaY -= this.PAN_SPEED;
      if (
        this.activeKeys.has(this.keybinds.moveLeft) ||
        this.activeKeys.has("ArrowLeft")
      )
        deltaX += this.PAN_SPEED;
      if (
        this.activeKeys.has(this.keybinds.moveRight) ||
        this.activeKeys.has("ArrowRight")
      )
        deltaX -= this.PAN_SPEED;

      if (deltaX || deltaY) {
        this.eventBus.emit(new DragEvent(deltaX, deltaY));
      }

      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;

      if (
        this.activeKeys.has(this.keybinds.zoomOut) ||
        this.activeKeys.has("Minus")
      ) {
        this.eventBus.emit(new ZoomEvent(cx, cy, this.ZOOM_SPEED));
      }
      if (
        this.activeKeys.has(this.keybinds.zoomIn) ||
        this.activeKeys.has("Equal")
      ) {
        this.eventBus.emit(new ZoomEvent(cx, cy, -this.ZOOM_SPEED));
      }
    }, 16);

    this.keydownListener = (e: KeyboardEvent) => {
      if (this.isEditableTarget(e)) {
        return;
      }
      if (e.code === this.keybinds.toggleView) {
        e.preventDefault();
        if (!this.alternateView) {
          this.alternateView = true;
          this.eventBus.emit(new AlternateViewEvent(true));
        }
      }

      if (e.code === "Escape") {
        e.preventDefault();
        this.eventBus.emit(new CloseViewEvent());
      }

      if (
        [
          this.keybinds.moveUp,
          this.keybinds.moveDown,
          this.keybinds.moveLeft,
          this.keybinds.moveRight,
          this.keybinds.zoomOut,
          this.keybinds.zoomIn,
          "ArrowUp",
          "ArrowLeft",
          "ArrowDown",
          "ArrowRight",
          "Minus",
          "Equal",
          this.keybinds.attackRatioDown,
          this.keybinds.attackRatioUp,
          this.keybinds.centerCamera,
          "ControlLeft",
          "ControlRight",
          "ShiftLeft",
          "ShiftRight",
        ].includes(e.code)
      ) {
        this.activeKeys.add(e.code);
      }
    };
    this.keyupListener = (e: KeyboardEvent) => {
      if (this.isEditableTarget(e)) {
        return;
      }
      if (e.code === this.keybinds.toggleView) {
        e.preventDefault();
        this.alternateView = false;
        this.eventBus.emit(new AlternateViewEvent(false));
      }

      if (e.key.toLowerCase() === "r" && e.altKey && !e.ctrlKey) {
        e.preventDefault();
        this.eventBus.emit(new RedrawGraphicsEvent());
      }

      if (e.code === this.keybinds.boatAttack) {
        e.preventDefault();
        this.eventBus.emit(new DoBoatAttackEvent());
      }

      if (e.code === this.keybinds.groundAttack) {
        e.preventDefault();
        this.eventBus.emit(new DoGroundAttackEvent());
      }

      if (e.code === this.keybinds.attackRatioDown) {
        e.preventDefault();
        this.eventBus.emit(new AttackRatioEvent(-10));
      }

      if (e.code === this.keybinds.attackRatioUp) {
        e.preventDefault();
        this.eventBus.emit(new AttackRatioEvent(10));
      }

      if (e.code === this.keybinds.centerCamera) {
        e.preventDefault();
        this.eventBus.emit(new CenterCameraEvent());
      }

      if (e.code === "KeyD" && e.shiftKey) {
        e.preventDefault();
        console.log("TogglePerformanceOverlayEvent");
        this.eventBus.emit(new TogglePerformanceOverlayEvent());
      }

      this.activeKeys.delete(e.code);
    };

    window.addEventListener("keydown", this.keydownListener);
    window.addEventListener("keyup", this.keyupListener);
  }

  private onPointerDown(event: PointerEvent) {
    if (event.button === 1) {
      event.preventDefault();
      this.eventBus.emit(new AutoUpgradeEvent(event.clientX, event.clientY));
      return;
    }

    if (event.button > 0) {
      return;
    }

    this.pointerDown = true;
    this.pointers.set(event.pointerId, event);

    if (this.pointers.size === 1) {
      this.lastPointerX = event.clientX;
      this.lastPointerY = event.clientY;

      this.lastPointerDownX = event.clientX;
      this.lastPointerDownY = event.clientY;

      this.eventBus.emit(new MouseDownEvent(event.clientX, event.clientY));
    } else if (this.pointers.size === 2) {
      this.lastPinchDistance = this.getPinchDistance();
    }
  }

  onPointerUp(event: PointerEvent) {
    if (event.button === 1) {
      event.preventDefault();
      return;
    }

    if (event.button > 0) {
      return;
    }
    this.pointerDown = false;
    this.pointers.clear();

    if (this.isModifierKeyPressed(event)) {
      this.eventBus.emit(new ShowBuildMenuEvent(event.clientX, event.clientY));
      return;
    }
    if (this.isAltKeyPressed(event)) {
      this.eventBus.emit(new ShowEmojiMenuEvent(event.clientX, event.clientY));
      return;
    }

    const dist =
      Math.abs(event.x - this.lastPointerDownX) +
      Math.abs(event.y - this.lastPointerDownY);
    if (dist < 10) {
      if (event.pointerType === "touch") {
        this.eventBus.emit(new ContextMenuEvent(event.clientX, event.clientY));
        event.preventDefault();
        return;
      }

      if (!this.userSettings.leftClickOpensMenu() || event.shiftKey) {
        this.eventBus.emit(new MouseUpEvent(event.x, event.y));
      } else {
        this.eventBus.emit(new ContextMenuEvent(event.clientX, event.clientY));
      }
    }
  }

  private onScroll(event: WheelEvent) {
    if (!event.shiftKey) {
      const realCtrl =
        this.activeKeys.has("ControlLeft") ||
        this.activeKeys.has("ControlRight");

      const isZoomGesture =
        event.ctrlKey ||
        event.metaKey ||
        Math.abs(event.deltaZ) > 0 ||
        (event.deltaMode === 1 && Math.abs(event.deltaY) > 0) ||
        (event.deltaMode === 0 && Math.abs(event.deltaY) >= 50);

      if (isZoomGesture) {
        const ratio = event.ctrlKey && !realCtrl ? 10 : 1;
        this.eventBus.emit(
          new ZoomEvent(event.x, event.y, event.deltaY * ratio),
        );
      }
    }
  }

  private onShiftScroll(event: WheelEvent) {
    if (event.shiftKey) {
      const scrollValue = event.deltaY === 0 ? event.deltaX : event.deltaY;
      const ratio = scrollValue > 0 ? -10 : 10;
      this.eventBus.emit(new AttackRatioEvent(ratio));
    }
  }

  private onTrackpadPan(event: WheelEvent) {
    if (event.shiftKey) {
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      return;
    }

    const isTrackpadPan =
      event.deltaMode === 0 &&
      (Math.abs(event.deltaX) > 0 || Math.abs(event.deltaY) > 0) &&
      ((Math.abs(event.deltaX) > 0 && Math.abs(event.deltaY) > 0) ||
        event.deltaX % 1 !== 0 ||
        event.deltaY % 1 !== 0 ||
        (Math.abs(event.deltaX) < 30 && Math.abs(event.deltaY) < 30));

    if (isTrackpadPan) {
      const panSensitivity = 1.0;
      const deltaX = -event.deltaX * panSensitivity;
      const deltaY = -event.deltaY * panSensitivity;

      if (Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5) {
        this.eventBus.emit(new DragEvent(deltaX, deltaY));
      }
    }
  }

  private onPointerMove(event: PointerEvent) {
    if (event.button === 1) {
      event.preventDefault();
      return;
    }

    if (event.button > 0) {
      return;
    }

    this.pointers.set(event.pointerId, event);

    if (!this.pointerDown) {
      this.eventBus.emit(new MouseOverEvent(event.clientX, event.clientY));
      return;
    }

    if (this.pointers.size === 1) {
      const deltaX = event.clientX - this.lastPointerX;
      const deltaY = event.clientY - this.lastPointerY;

      this.eventBus.emit(new DragEvent(deltaX, deltaY));

      this.lastPointerX = event.clientX;
      this.lastPointerY = event.clientY;
    } else if (this.pointers.size === 2) {
      const currentPinchDistance = this.getPinchDistance();
      const pinchDelta = currentPinchDistance - this.lastPinchDistance;

      if (Math.abs(pinchDelta) > 1) {
        const zoomCenter = this.getPinchCenter();
        this.eventBus.emit(
          new ZoomEvent(zoomCenter.x, zoomCenter.y, -pinchDelta * 2),
        );
        this.lastPinchDistance = currentPinchDistance;
      }
    }
  }

  private onContextMenu(event: MouseEvent) {
    event.preventDefault();
    this.eventBus.emit(new ContextMenuEvent(event.clientX, event.clientY));
  }

  private onTouchStart(event: TouchEvent) {
    if (event.touches.length === 2) {
      event.preventDefault();
    }
  }

  private onTouchMove(event: TouchEvent) {
    if (event.touches.length === 2) {
      event.preventDefault();

      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      const centerX = (touch1.clientX + touch2.clientX) / 2;
      const centerY = (touch1.clientY + touch2.clientY) / 2;

      if (this.lastPointerX !== 0 && this.lastPointerY !== 0) {
        const deltaX = centerX - this.lastPointerX;
        const deltaY = centerY - this.lastPointerY;

        if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
          this.eventBus.emit(new DragEvent(deltaX, deltaY));
        }
      }

      this.lastPointerX = centerX;
      this.lastPointerY = centerY;
    }
  }

  private onTouchEnd(event: TouchEvent) {
    if (event.touches.length < 2) {
      this.lastPointerX = 0;
      this.lastPointerY = 0;
    }
  }

  private getPinchDistance(): number {
    const pointerEvents = Array.from(this.pointers.values());
    const dx = pointerEvents[0].clientX - pointerEvents[1].clientX;
    const dy = pointerEvents[0].clientY - pointerEvents[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private getPinchCenter(): { x: number; y: number } {
    const pointerEvents = Array.from(this.pointers.values());
    return {
      x: (pointerEvents[0].clientX + pointerEvents[1].clientX) / 2,
      y: (pointerEvents[0].clientY + pointerEvents[1].clientY) / 2,
    };
  }

  destroy() {
    if (!this.isInitialized) return;

    if (this.moveInterval !== null) {
      clearInterval(this.moveInterval);
      this.moveInterval = null;
    }

    if (this.pointerDownListener)
      this.canvas.removeEventListener("pointerdown", this.pointerDownListener);
    if (this.pointerUpListener)
      window.removeEventListener("pointerup", this.pointerUpListener);
    if (this.wheelListener)
      this.canvas.removeEventListener("wheel", this.wheelListener as EventListener);
    if (this.pointerMoveWindowListener)
      window.removeEventListener("pointermove", this.pointerMoveWindowListener);
    if (this.contextMenuListener)
      this.canvas.removeEventListener("contextmenu", this.contextMenuListener);
    if (this.mouseMoveWindowListener)
      window.removeEventListener("mousemove", this.mouseMoveWindowListener);
    if (this.touchStartListener)
      this.canvas.removeEventListener("touchstart", this.touchStartListener as EventListener);
    if (this.touchMoveListener)
      this.canvas.removeEventListener("touchmove", this.touchMoveListener as EventListener);
    if (this.touchEndListener)
      this.canvas.removeEventListener("touchend", this.touchEndListener as EventListener);
    if (this.keydownListener)
      window.removeEventListener("keydown", this.keydownListener);
    if (this.keyupListener)
      window.removeEventListener("keyup", this.keyupListener);

    this.pointerDownListener = undefined;
    this.pointerUpListener = undefined;
    this.wheelListener = undefined;
    this.pointerMoveWindowListener = undefined;
    this.contextMenuListener = undefined;
    this.mouseMoveWindowListener = undefined;
    this.touchStartListener = undefined;
    this.touchMoveListener = undefined;
    this.touchEndListener = undefined;
    this.keydownListener = undefined;
    this.keyupListener = undefined;

    this.pointers.clear();
    this.activeKeys.clear();
    this.isInitialized = false;
  }

  isModifierKeyPressed(event: PointerEvent): boolean {
    return (
      (this.keybinds.modifierKey === "AltLeft" && event.altKey) ||
      (this.keybinds.modifierKey === "ControlLeft" && event.ctrlKey) ||
      (this.keybinds.modifierKey === "ShiftLeft" && event.shiftKey) ||
      (this.keybinds.modifierKey === "MetaLeft" && event.metaKey)
    );
  }

  isAltKeyPressed(event: PointerEvent): boolean {
    return (
      (this.keybinds.altKey === "AltLeft" && event.altKey) ||
      (this.keybinds.altKey === "ControlLeft" && event.ctrlKey) ||
      (this.keybinds.altKey === "ShiftLeft" && event.shiftKey) ||
      (this.keybinds.altKey === "MetaLeft" && event.metaKey)
    );
  }
}
