declare module 'qrcode' {
  function toDataURL(text: string): Promise<string>;
  function toCanvas(canvas: any, text: string): Promise<void>;
  function toString(text: string): Promise<string>;
  export { toDataURL, toCanvas, toString };
}
