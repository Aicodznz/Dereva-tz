/**
 * ESC/POS Thermal Printer Protocol & Formatter for 58mm / 80mm Mobile Bluetooth & USB Printers
 */

export class EscPosEncoder {
  private buffer: number[] = [];

  constructor() {
    this.init();
  }

  init() {
    // ESC @ - Initialize printer
    this.buffer.push(0x1B, 0x40);
    return this;
  }

  align(align: 'left' | 'center' | 'right') {
    // ESC a n
    const val = align === 'left' ? 0 : (align === 'center' ? 1 : 2);
    this.buffer.push(0x1B, 0x61, val);
    return this;
  }

  bold(enable: boolean) {
    // ESC E n
    this.buffer.push(0x1B, 0x45, enable ? 1 : 0);
    return this;
  }

  size(mode: 'normal' | 'double_height' | 'double_width' | 'double_both') {
    // GS ! n
    let val = 0x00;
    if (mode === 'double_height') val = 0x01;
    if (mode === 'double_width') val = 0x10;
    if (mode === 'double_both') val = 0x11;
    this.buffer.push(0x1D, 0x21, val);
    return this;
  }

  text(str: string) {
    // Convert string to bytes
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    for (let i = 0; i < bytes.length; i++) {
      this.buffer.push(bytes[i]);
    }
    return this;
  }

  line(str: string = '') {
    this.text(str + '\n');
    return this;
  }

  divider(char: string = '-', width: number = 32) {
    this.line(char.repeat(width));
    return this;
  }

  tableRow(col1: string, col2: string, width: number = 32) {
    const col2Len = col2.length;
    const col1Max = width - col2Len - 1;
    const col1Trim = col1.slice(0, col1Max);
    const spaces = Math.max(1, width - col1Trim.length - col2Len);
    this.line(col1Trim + ' '.repeat(spaces) + col2);
    return this;
  }

  feed(lines: number = 3) {
    // ESC d n
    this.buffer.push(0x1B, 0x64, lines);
    return this;
  }

  cut() {
    // GS V 66 0 - Partial/full cut
    this.buffer.push(0x1D, 0x56, 0x42, 0x00);
    return this;
  }

  encode(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

/**
 * Direct Web Bluetooth ESC/POS Print Connector
 */
export async function printViaBluetooth(bytes: Uint8Array): Promise<boolean> {
  const nav = navigator as any;
  if (!nav.bluetooth) {
    throw new Error('Web Bluetooth haipatikani kwenye kivinjari hiki (tumia Google Chrome au Edge).');
  }

  try {
    const device = await nav.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [
        '000018f0-0000-1000-8000-00805f9b34fb', // Standard Printer Service
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
        '49535343-fe7d-4ae5-8fa9-9fafd205e455'  // Raw Bluetooth serial
      ]
    });

    if (!device.gatt) {
      throw new Error('GATT server haipatikani.');
    }

    const server = await device.gatt.connect();
    const services = await server.getPrimaryServices();
    
    let writeChar: any = null;
    for (const service of services) {
      const characteristics = await service.getCharacteristics();
      for (const char of characteristics) {
        if (char.properties.write || char.properties.writeWithoutResponse) {
          writeChar = char;
          break;
        }
      }
      if (writeChar) break;
    }

    if (!writeChar) {
      throw new Error('Haiwezi kupata printer write characteristic.');
    }

    // Send chunks (MTU ~ 512 bytes)
    const chunkSize = 256;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.slice(i, i + chunkSize);
      await writeChar.writeValue(chunk);
    }

    return true;
  } catch (err: any) {
    console.error('Bluetooth thermal print error:', err);
    throw err;
  }
}
