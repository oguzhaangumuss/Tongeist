import Tesseract from 'tesseract.js'
import sharp from 'sharp'
import { OCRResult } from '../types'

export class OCRProcessor {
  async processLicenseImage(imageBuffer: Buffer): Promise<OCRResult> {
    console.log('📸 Starting license image processing...')
    
    try {
      // Process image with Sharp (enhance for better OCR)
      const processedImage = await sharp(imageBuffer)
        .resize(800, null, { withoutEnlargement: false }) // Upscale for better OCR
        .grayscale()
        .normalize()
        .sharpen()
        .gamma(1.2) // Improve contrast
        .png()
        .toBuffer()
      
      console.log('🔍 Running OCR on processed image...')
      
      // Run OCR with Tesseract
      const { data } = await Tesseract.recognize(processedImage, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            const progress = Math.round(m.progress * 100)
            console.log(`OCR Progress: ${progress}%`)
          }
        }
      })
      
      console.log('📝 OCR completed, extracting license info...')
      
      // Clean and format the OCR text
      const cleanedText = this.cleanOCRText(data.text)
      
      // Extract license information
      const licenseNumber = this.extractLicenseNumber(cleanedText)
      const expirationDate = this.extractExpirationDate(cleanedText)
      
      return {
        text: cleanedText,
        confidence: data.confidence,
        licenseNumber,
        expirationDate
      }
      
    } catch (error) {
      console.error('❌ OCR processing failed:', error)
      throw error
    }
  }

  private extractLicenseNumber(text: string): string | undefined {
    // Enhanced license number patterns for better extraction
    const patterns = [
      // UK License formats (most specific first) 
      /5\s+([A-Z]{5}\d+[A-Za-z]+)/g,                // UK: "5 MORGA7S3ifesMol" (field 5 format)
      /\b([A-Z]{5}\d+[A-Za-z]+[a-z]*[A-Z]*)\b/g,    // UK: MORGA7S3ifesMol (mixed case alphanumeric)
      /\b([A-Z]{3,5}\d{1,2}[A-Z]{2,8}[a-z]{0,5})\b/g, // UK variations
      
      // US License formats
      /(?:DL|LICENSE|LIC)[\s#:]*([A-Z]?\d{7,8})/gi,  // DL: A1234567 or DL 01234567
      /(?:^|\s)([A-Z]\d{7})(?=\s|$)/gm,              // A1234567 format standalone
      /(?:^|\s)([A-Z]{2}\d{6})(?=\s|$)/gm,           // AB123456 format standalone  
      /(?:^|\s)(\d{8})(?=\s|$)/gm,                   // 12345678 format standalone
      /(?:^|\s)([A-Z]\d{6})(?=\s|$)/gm,              // A123456 format standalone
      /\b(\d{8})\b/g,                               // Any 8-digit number
      /\b([A-Z]\d{7})\b/g                           // Any letter + 7 digits
    ]
    
    for (const pattern of patterns) {
      const matches = text.match(pattern)
      if (matches && matches.length > 0) {
        // Clean the match (remove prefixes like DL:, LICENSE:)
        let licenseNumber = matches[0].replace(/^(?:DL|LICENSE|LIC)[\s#:]*/i, '').trim()
        console.log(`🔍 Found license number: ${licenseNumber}`)
        return licenseNumber
      }
    }
    
    console.log('❌ No license number found in OCR text')
    console.log('🔍 OCR text for debugging:', text.substring(0, 200))
    return undefined
  }

  private extractExpirationDate(text: string): string | undefined {
    // Common date patterns
    const patterns = [
      /\d{2}\/\d{2}\/\d{4}/g,     // MM/DD/YYYY
      /\d{2}-\d{2}-\d{4}/g,       // MM-DD-YYYY
      /\d{4}-\d{2}-\d{2}/g,       // YYYY-MM-DD
      /\d{2}\.\d{2}\.\d{4}/g,     // MM.DD.YYYY
    ]
    
    for (const pattern of patterns) {
      const matches = text.match(pattern)
      if (matches && matches.length > 0) {
        console.log(`📅 Found expiration date: ${matches[0]}`)
        return matches[0]
      }
    }
    
    console.log('❌ No expiration date found in OCR text')
    return undefined
  }

  private cleanOCRText(text: string): string {
    return text
      .replace(/[|~]/g, '') // Remove vertical bars and tildes
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n\s*\n/g, '\n') // Remove empty lines
      .trim()
  }
}