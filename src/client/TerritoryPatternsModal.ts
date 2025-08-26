import "./components/Difficulties";
import "./components/Maps";
import { LitElement, html, render } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import { handlePurchase, patterns } from "./Cosmetics";
import { Pattern } from "../core/CosmeticSchemas";
import { PatternDecoder } from "../core/PatternDecoder";
import type { TemplateResult } from "lit";
import { UserMeResponse } from "../core/ApiSchemas";
import { UserSettings } from "../core/game/UserSettings";
import { base64url } from "jose";
import { translateText } from "./Utils";

@customElement("territory-patterns-modal")
export class TerritoryPatternsModal extends LitElement {
  @query("o-modal") private readonly modalEl!: HTMLElement & {
    open: () => void;
    close: () => void;
  };

  public previewButton: HTMLElement | null = null;
  public buttonWidth = 150;

  @state() private selectedPattern: string | undefined;

  @state() private lockedPatterns: string[] = [];
  @state() private lockedReasons: Record<string, string> = {};
  @state() private hoveredPattern: Pattern | null = null;
  @state() private hoverPosition = { x: 0, y: 0 };

  @state() private keySequence: string[] = [];
  @state() private showChocoPattern = false;

  private patterns: Pattern[] = [];
  private me: UserMeResponse | null = null;

  public resizeObserver: ResizeObserver;

  private readonly userSettings: UserSettings = new UserSettings();

  private isActive = false;

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("keydown", this.handleKeyDown);
    this.selectedPattern = this.userSettings.getSelectedPattern();
    this.updateComplete.then(() => {
      const containers = this.renderRoot.querySelectorAll(".preview-container");
      if (this.resizeObserver) {
        containers.forEach((container) =>
          this.resizeObserver.observe(container),
        );
      }
      this.updatePreview();
    });
    this.open();
  }

  disconnectedCallback() {
    window.removeEventListener("keydown", this.handleKeyDown);
    super.disconnectedCallback();
  }

  async onUserMe(userMeResponse: UserMeResponse | null) {
    this.patterns = await patterns(userMeResponse);
    this.me = userMeResponse;
    this.requestUpdate();
  }

  private readonly handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === "Escape") {
      e.preventDefault();
      this.close();
    }

    const key = e.key.toLowerCase();
    const nextSequence = [...this.keySequence, key].slice(-5);
    this.keySequence = nextSequence;

    if (nextSequence.join("") === "choco") {
      this.triggerChocoEasterEgg();
      this.keySequence = [];
    }
  };

  private triggerChocoEasterEgg() {
    console.log("🍫 Choco pattern unlocked!");
    this.showChocoPattern = true;

    const popup = document.createElement("div");
    popup.className = "easter-egg-popup";
    popup.textContent = "🎉 You unlocked the Choco pattern!";
    document.body.appendChild(popup);

    setTimeout(() => {
      popup.remove();
    }, 5000);

    this.requestUpdate();
  }

  createRenderRoot() {
    return this;
  }

  private renderTooltip(): TemplateResult | null {
    if (this.hoveredPattern && this.hoveredPattern.product !== undefined) {
      return html`
        <div
          class="fixed z-[10000] px-3 py-2 rounded bg-black text-white text-sm pointer-events-none shadow-md"
          style="top: ${this.hoverPosition.y + 12}px; left: ${this.hoverPosition
            .x + 12}px;"
        >
          ${translateText("territory_patterns.blocked.purchase")}
        </div>
      `;
    }
    return null;
  }

  private renderPatternButton(pattern: Pattern): TemplateResult {
    const isSelected = this.selectedPattern === pattern.pattern;

    return html`
      <div style="flex: 0 1 calc(25% - 1rem); max-width: calc(25% - 1rem);">
        <button
          class="border p-2 rounded-lg shadow text-black dark:text-white text-left w-full
          ${isSelected
            ? "bg-blue-500 text-white"
            : "bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"}
          ${pattern.product !== null ? "opacity-50 cursor-not-allowed" : ""}"
          @click=${() =>
            pattern.product === null && this.selectPattern(pattern.pattern)}
          @mouseenter=${(e: MouseEvent) => this.handleMouseEnter(pattern, e)}
          @mousemove=${(e: MouseEvent) => this.handleMouseMove(e)}
          @mouseleave=${() => this.handleMouseLeave()}
        >
          <div class="text-sm font-bold mb-1">
            ${translateText(`territory_patterns.pattern.${pattern.name}`)}
          </div>
          <div
            class="preview-container"
            style="
              width: 100%;
              aspect-ratio: 1;
              display: flex;
              align-items: center;
              justify-content: center;
              background: #fff;
              border-radius: 8px;
              overflow: hidden;
            "
          >
            ${this.renderPatternPreview(
              pattern.pattern,
              this.buttonWidth,
              this.buttonWidth,
            )}
          </div>
        </button>
        ${pattern.product !== null
          ? html`
              <button
                class="w-full mt-2 px-3 py-1 bg-green-500 hover:bg-green-600
                text-white text-xs font-medium rounded transition-colors"
                @click=${(e: Event) => {
                  e.stopPropagation();
                  handlePurchase(pattern.product!.priceId);
                }}
              >
                ${translateText("territory_patterns.purchase")}
                (${pattern.product.price})
              </button>
            `
          : null}
      </div>
    `;
  }

  private renderPatternGrid(): TemplateResult {
    const buttons: TemplateResult[] = [];
    for (const pattern of this.patterns) {
      if (!this.showChocoPattern && pattern.name === "choco") continue;

      const result = this.renderPatternButton(pattern);
      buttons.push(result);
    }

    return html`
      <div
        class="flex flex-wrap gap-4 p-2"
        style="justify-content: center; align-items: flex-start;"
      >
        <button
          class="border p-2 rounded-lg shadow text-black dark:text-white text-left
          ${this.selectedPattern === undefined
            ? "bg-blue-500 text-white"
            : "bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"}"
          style="flex: 0 1 calc(25% - 1rem); max-width: calc(25% - 1rem);"
          @click=${() => this.selectPattern(undefined)}
        >
          <div class="text-sm font-bold mb-1">
            ${translateText("territory_patterns.pattern.default")}
          </div>
          <div
            class="preview-container"
            style="
              width: 100%;
              aspect-ratio: 1;
              display: flex;
              align-items: center;
              justify-content: center;
              background: #fff;
              border-radius: 8px;
              overflow: hidden;
            "
          >
            ${this.renderBlankPreview(this.buttonWidth, this.buttonWidth)}
          </div>
        </button>
        ${buttons}
      </div>
    `;
  }

  render() {
    if (!this.isActive) return html``;
    return html`
      ${this.renderTooltip()}
      <o-modal
        id="territoryPatternsModal"
        title="${translateText("territory_patterns.title")}"
      >
        ${this.renderPatternGrid()}
      </o-modal>
    `;
  }

  public open() {
    this.modalEl?.open();
    window.addEventListener("keydown", this.handleKeyDown);
    this.isActive = true;
    this.requestUpdate();
  }

  public close() {
    this.modalEl?.close();
    window.removeEventListener("keydown", this.handleKeyDown);
    this.resizeObserver?.disconnect();
    this.isActive = false;
  }

  private selectPattern(pattern: string | undefined) {
    this.userSettings.setSelectedPattern(pattern);
    this.selectedPattern = pattern;
    this.updatePreview();
    this.close();
  }

  private renderPatternPreview(
    pattern?: string,
    width?: number,
    height?: number,
  ): TemplateResult {
    return html`
      <img src="${generatePreviewDataUrl(pattern, width, height)}"></img>
    `;
  }

  private renderBlankPreview(width: number, height: number): TemplateResult {
    return html`
      <div
        style="
          display: flex;
          align-items: center;
          justify-content: center;
          height: ${height}px;
          width: ${width}px;
          background-color: #ffffff;
          border-radius: 4px;
          box-sizing: border-box;
          overflow: hidden;
          position: relative;
          border: 1px solid #ccc;
        "
      >
        <div
          style="display: grid; grid-template-columns: repeat(2, ${width /
          2}px); grid-template-rows: repeat(2, ${height / 2}px);"
        >
          <div
            style="background-color: #fff; border: 1px solid rgba(0, 0, 0, 0.1); width: ${width /
            2}px; height: ${height / 2}px;"
          ></div>
          <div
            style="background-color: #fff; border: 1px solid rgba(0, 0, 0, 0.1); width: ${width /
            2}px; height: ${height / 2}px;"
          ></div>
          <div
            style="background-color: #fff; border: 1px solid rgba(0, 0, 0, 0.1); width: ${width /
            2}px; height: ${height / 2}px;"
          ></div>
          <div
            style="background-color: #fff; border: 1px solid rgba(0, 0, 0, 0.1); width: ${width /
            2}px; height: ${height / 2}px;"
          ></div>
        </div>
      </div>
    `;
  }

  public updatePreview() {
    if (this.previewButton === null) return;
    const preview = this.renderPatternPreview(this.selectedPattern, 48, 48);
    render(preview, this.previewButton);
  }

  private setLockedPatterns(lockedPatterns: string[], reason: string) {
    this.lockedPatterns = [...this.lockedPatterns, ...lockedPatterns];
    this.lockedReasons = {
      ...this.lockedReasons,
      ...lockedPatterns.reduce(
        (acc, key) => {
          acc[key] = reason;
          return acc;
        },
        {} as Record<string, string>,
      ),
    };
  }

  private handleMouseEnter(pattern: Pattern, event: MouseEvent) {
    if (pattern.product !== null) {
      this.hoveredPattern = pattern;
      this.hoverPosition = { x: event.clientX, y: event.clientY };
    }
  }

  private handleMouseMove(event: MouseEvent) {
    if (this.hoveredPattern) {
      this.hoverPosition = { x: event.clientX, y: event.clientY };
    }
  }

  private handleMouseLeave() {
    this.hoveredPattern = null;
  }
}

const patternCache = new Map<string, string>();
const DEFAULT_PATTERN_B64 = "AAAAAA"; // Empty 2x2 pattern
const COLOR_SET = [0, 0, 0, 255]; // Black
const COLOR_UNSET = [255, 255, 255, 255]; // White
export function generatePreviewDataUrl(
  pattern?: string,
  width?: number,
  height?: number,
): string {
  pattern ??= DEFAULT_PATTERN_B64;

  if (patternCache.has(pattern)) {
    return patternCache.get(pattern)!;
  }

  // Calculate canvas size
  const decoder = new PatternDecoder(pattern, base64url.decode);
  const scaledWidth = decoder.scaledWidth();
  const scaledHeight = decoder.scaledHeight();

  width =
    width === undefined
      ? scaledWidth
      : Math.max(1, Math.floor(width / scaledWidth)) * scaledWidth;
  height =
    height === undefined
      ? scaledHeight
      : Math.max(1, Math.floor(height / scaledHeight)) * scaledHeight;

  // Create the canvas
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context not supported");

  // Create an image
  const imageData = ctx.createImageData(width, height);
  const { data } = imageData;
  let i = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const rgba = decoder.isSet(x, y) ? COLOR_SET : COLOR_UNSET;
      data[i++] = rgba[0]; // Red
      data[i++] = rgba[1]; // Green
      data[i++] = rgba[2]; // Blue
      data[i++] = rgba[3]; // Alpha
    }
  }

  // Create a data URL
  ctx.putImageData(imageData, 0, 0);
  const dataUrl = canvas.toDataURL("image/png");
  patternCache.set(pattern, dataUrl);
  return dataUrl;
}
