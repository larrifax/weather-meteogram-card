interface RegisterCardParams {
  type: string;
  name: string;
  description: string;
}

/** Add the card to Home Assistant's card picker (Add card dialog). */
export function registerCustomCard(params: RegisterCardParams): void {
  const win = window as unknown as { customCards?: unknown[] };
  win.customCards = win.customCards || [];
  win.customCards.push({ ...params, preview: true });
}
