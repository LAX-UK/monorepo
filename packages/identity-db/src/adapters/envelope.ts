export type EnvelopeCrypto = {
  seal(plaintext: string): string;
  open(sealed: string): string;
};
