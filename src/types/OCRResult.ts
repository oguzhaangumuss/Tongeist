export interface OCRResult {
  text: string
  confidence: number
  licenseNumber?: string
  expirationDate?: string
}