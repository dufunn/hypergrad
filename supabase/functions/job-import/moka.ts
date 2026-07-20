const MAX_CIPHERTEXT_CHARS = 3_000_000;

function base64Bytes(value: string): Uint8Array {
  if (!value || value.length > MAX_CIPHERTEXT_CHARS) throw new Error("Moka 岗位详情内容异常。");
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function decryptMokaPayload(payload: unknown, aesIv: string): Promise<unknown> {
  const wrapper = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const ciphertext = String(wrapper.data || "");
  const keyValue = String(wrapper.necromancer || "");
  if (![16, 24, 32].includes(keyValue.length) || aesIv.length !== 16 || !ciphertext) {
    throw new Error("Moka 岗位详情返回格式发生变化，请粘贴 JD 文本。");
  }
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", encoder.encode(keyValue), { name: "AES-CBC" }, false, ["decrypt"]);
    const plaintext = await crypto.subtle.decrypt({ name: "AES-CBC", iv: encoder.encode(aesIv) }, key, base64Bytes(ciphertext));
    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    throw new Error("Moka 岗位详情暂时无法解密，请粘贴 JD 文本。");
  }
}
