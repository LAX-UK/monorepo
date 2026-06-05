import QRCode from "qrcode";

export class PassQrRenderService {
  async renderSvg(passUrl: string): Promise<string> {
    return QRCode.toString(passUrl, {
      type: "svg",
      errorCorrectionLevel: "H",
      margin: 2,
      color: {
        dark: "#1a1a1a",
        light: "#ffffff",
      },
    });
  }

  async renderPngBase64(passUrl: string): Promise<string> {
    const buffer = await QRCode.toBuffer(passUrl, {
      type: "png",
      errorCorrectionLevel: "H",
      margin: 2,
      width: 280,
      color: {
        dark: "#1a1a1a",
        light: "#ffffff",
      },
    });
    return buffer.toString("base64");
  }
}
