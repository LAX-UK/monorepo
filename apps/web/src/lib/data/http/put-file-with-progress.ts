/** Sends a file to a presigned address and reports how much has gone. */
export function putFileWithProgress(
  url: string,
  file: File,
  headers: Headers,
  onProgress?: (loaded: number, total: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    headers.forEach((value, key) => xhr.setRequestHeader(key, value));
    if (onProgress) {
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) onProgress(event.loaded, event.total);
      });
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else {
        const detail = xhr.responseText?.trim().slice(0, 200);
        reject(
          new Error(
            detail
              ? `Object storage rejected the upload (${xhr.status}: ${detail})`
              : `Object storage rejected the upload (${xhr.status})`,
          ),
        );
      }
    };
    xhr.onerror = () =>
      reject(
        new Error(
          "Object storage rejected the upload (network or CORS error — check browser devtools)",
        ),
      );
    xhr.send(file);
  });
}
