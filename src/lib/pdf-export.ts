import { jsPDF } from "jspdf";
import { blobToDataUrl, loadImage } from "@/lib/image-process";

export async function pagesToPdf(blobs: Blob[]): Promise<Blob> {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "p" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const maxW = pageW - margin * 2;
  const maxH = pageH - margin * 2;

  for (let i = 0; i < blobs.length; i++) {
    if (i > 0) pdf.addPage();
    const dataUrl = await blobToDataUrl(blobs[i]!);
    const img = await loadImage(dataUrl);
    const ratio = img.naturalWidth / img.naturalHeight;
    let w = maxW;
    let h = w / ratio;
    if (h > maxH) {
      h = maxH;
      w = h * ratio;
    }
    const x = (pageW - w) / 2;
    const y = (pageH - h) / 2;
    const format = blobs[i]!.type.includes("png") ? "PNG" : "JPEG";
    pdf.addImage(dataUrl, format, x, y, w, h);
  }

  return pdf.output("blob");
}
