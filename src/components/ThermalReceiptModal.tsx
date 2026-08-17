import React, { useState, useRef } from 'react';
import { 
  Printer, 
  Bluetooth, 
  X, 
  Share2, 
  Sparkles, 
  Utensils, 
  CheckCircle2, 
  Receipt, 
  Layers, 
  Loader2, 
  MessageSquare,
  Flame,
  FileText
} from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { VendorProfile, Order, ThermalPrintOptions } from '../types';
import { EscPosEncoder, printViaBluetooth } from '../utils/thermalPrinter';
import { buildCustomerReceiptWhatsAppUrl, buildKitchenOrderWhatsAppUrl } from '../utils/whatsappHelper';

interface ThermalReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  vendor: VendorProfile;
}

export const ThermalReceiptModal: React.FC<ThermalReceiptModalProps> = ({
  isOpen,
  onClose,
  order,
  vendor
}) => {
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>('58mm');
  const [printMode, setPrintMode] = useState<'customer_bill' | 'kitchen_kot'>('customer_bill');
  const [isBluetoothPrinting, setIsBluetoothPrinting] = useState(false);

  if (!isOpen || !order) return null;

  const vendorName = vendor?.businessName || 'Papo Hapo Restaurant';
  const vendorPhone = vendor?.phoneNumber || (vendor as any)?.phone || '+255 7XX XXX XXX';
  const tableNum = order.tableNumber || '';
  const orderId = order.id ? String(order.id).slice(-6).toUpperCase() : 'REC-' + Date.now().toString().slice(-4);
  const items = order.items || [];
  const subtotal = order.originalSubtotal || order.subtotal || order.totalAmount || 0;
  const discount = order.discountAmount || 0;
  const total = order.totalAmount || 0;

  // Build ESC/POS bytes for Bluetooth
  const generateEscPosData = () => {
    const encoder = new EscPosEncoder();
    const widthCols = paperWidth === '58mm' ? 32 : 48;

    if (printMode === 'kitchen_kot') {
      // KOT Mode
      encoder
        .align('center')
        .size('double_both')
        .bold(true)
        .line('** JIKONI / KOT **')
        .size('normal')
        .bold(false)
        .line(vendorName)
        .divider('=', widthCols);

      if (tableNum) {
        encoder
          .align('center')
          .size('double_both')
          .bold(true)
          .line(`MEZA #${tableNum}`)
          .size('normal')
          .bold(false);
      } else {
        encoder
          .align('center')
          .bold(true)
          .line(order.orderType === 'delivery' ? 'DELIVERY ODA' : 'TAKEAWAY / PICKUP')
          .bold(false);
      }

      encoder
        .divider('-', widthCols)
        .align('left')
        .line(`Oda: #${orderId}`)
        .line(`Muda: ${new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' })}`)
        .divider('=', widthCols)
        .bold(true);

      // Items
      items.forEach((it: any) => {
        const name = it.name || it.productName || 'Chakula';
        const qty = it.quantity || 1;
        encoder.line(`${qty}x ${name}`);
        if (it.selectedAddons?.length) {
          encoder.line(`  + ${it.selectedAddons.join(', ')}`);
        }
        if (it.notes || it.specialInstructions) {
          encoder.line(`  * NOTE: ${it.notes || it.specialInstructions}`);
        }
      });

      encoder
        .bold(false)
        .divider('=', widthCols)
        .feed(3)
        .cut();

    } else {
      // Customer Bill Mode
      encoder
        .align('center')
        .bold(true)
        .size('double_height')
        .line(vendorName)
        .size('normal')
        .bold(false)
        .line(vendor.address || 'Tanzania')
        .line(`Simu: ${vendorPhone}`)
        .divider('=', widthCols)
        .bold(true)
        .line(tableNum ? `RISITI YA MEZA #${tableNum}` : 'RISITI YA MALIPO')
        .bold(false)
        .line(`Oda: #${orderId}`)
        .line(`Tarehe: ${new Date().toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`)
        .line(`Mteja: ${order.customerName || 'Mteja'}`)
        .divider('-', widthCols);

      // Item rows
      items.forEach((it: any) => {
        const name = it.name || it.productName || 'Item';
        const qty = it.quantity || 1;
        const itemTotal = (it.price || 0) * qty;
        encoder.tableRow(`${qty}x ${name}`, `TZS ${itemTotal.toLocaleString()}`, widthCols);
      });

      encoder.divider('-', widthCols);
      encoder.tableRow('Jumla Ndogo:', `TZS ${subtotal.toLocaleString()}`, widthCols);

      if (discount > 0) {
        encoder.tableRow(`Punguzo (${order.couponCode || 'Promo'}):`, `-TZS ${discount.toLocaleString()}`, widthCols);
      }

      if (order.deliveryFee) {
        encoder.tableRow('Usafirishaji:', `TZS ${order.deliveryFee.toLocaleString()}`, widthCols);
      }

      encoder
        .divider('=', widthCols)
        .bold(true)
        .size('double_height')
        .tableRow('JUMLA KUU:', `TZS ${total.toLocaleString()}`, widthCols)
        .size('normal')
        .bold(false)
        .divider('=', widthCols)
        .align('center')
        .line(`Hali: ${order.paymentStatus === 'paid' ? 'LIMELIPWA (PAID)' : 'HAIJALIPWA (UNPAID)'}`)
        .feed(1)
        .line('ASANTE SANA KWA KUTUCHAGUA!')
        .line('KARIBU TENA PAPO HAPO!')
        .feed(3)
        .cut();
    }

    return encoder.encode();
  };

  const handleBrowserPrint = () => {
    window.print();
  };

  const handleBluetoothPrint = async () => {
    setIsBluetoothPrinting(true);
    try {
      const bytes = generateEscPosData();
      await printViaBluetooth(bytes);
      toast.success('Risiti imechapishwa kikamilifu kupitia Bluetooth Printer!');
    } catch (err: any) {
      if (err.name !== 'NotFoundError') {
        toast.error(err.message || 'Imeshindwa kuunganisha na Bluetooth Thermal Printer.');
      }
    } finally {
      setIsBluetoothPrinting(false);
    }
  };

  const handleShareWhatsApp = () => {
    const url = buildCustomerReceiptWhatsAppUrl(order, vendorName);
    window.open(url, '_blank');
  };

  const handleSendKitchenWhatsApp = () => {
    const kitchenPhone = vendor.kitchenWhatsappPhone || vendor.phoneNumber || '';
    if (!kitchenPhone) {
      toast.warning('Weka namba ya WhatsApp ya jikoni kwenye mipangilio ya duka.');
    }
    const url = buildKitchenOrderWhatsAppUrl(kitchenPhone, order, vendorName);
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Print Specific CSS for 58mm & 80mm */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #thermal-receipt-printable, #thermal-receipt-printable * {
            visibility: visible !important;
          }
          #thermal-receipt-printable {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: ${paperWidth === '58mm' ? '58mm' : '80mm'} !important;
            max-width: ${paperWidth === '58mm' ? '58mm' : '80mm'} !important;
            padding: 2mm !important;
            margin: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: ${paperWidth === '58mm' ? '10px' : '12px'} !important;
            line-height: 1.2 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-xl bg-neutral-950 border border-neutral-800 rounded-[2.5rem] p-6 sm:p-7 shadow-2xl relative text-white max-h-[95vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-white flex items-center gap-2">
                Uchapishaji wa Risiti ya Joto (Thermal ESC/POS)
              </h3>
              <p className="text-xs text-neutral-400">
                Inafaa kwa Bluetooth, USB Printers (58mm / 80mm) na WhatsApp
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Configuration Controls Bar */}
        <div className="py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 border-b border-neutral-800/80">
          {/* Mode Selector */}
          <div className="flex bg-neutral-900 p-1 rounded-xl border border-neutral-800 text-xs">
            <button
              type="button"
              onClick={() => setPrintMode('customer_bill')}
              className={`px-3 py-1.5 rounded-lg font-black uppercase text-[10px] transition-all cursor-pointer ${
                printMode === 'customer_bill' 
                  ? 'bg-amber-500 text-black shadow-sm' 
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Risiti ya Bili (Customer)
            </button>
            <button
              type="button"
              onClick={() => setPrintMode('kitchen_kot')}
              className={`px-3 py-1.5 rounded-lg font-black uppercase text-[10px] transition-all cursor-pointer ${
                printMode === 'kitchen_kot' 
                  ? 'bg-red-600 text-white shadow-sm' 
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              👨‍🍳 Jikoni (Kitchen KOT)
            </button>
          </div>

          {/* Paper Width Selector */}
          <div className="flex bg-neutral-900 p-1 rounded-xl border border-neutral-800 text-xs">
            <button
              type="button"
              onClick={() => setPaperWidth('58mm')}
              className={`px-2.5 py-1 rounded-lg font-black text-[10px] transition-all cursor-pointer ${
                paperWidth === '58mm' ? 'bg-white text-black' : 'text-neutral-400'
              }`}
            >
              58mm (2")
            </button>
            <button
              type="button"
              onClick={() => setPaperWidth('80mm')}
              className={`px-2.5 py-1 rounded-lg font-black text-[10px] transition-all cursor-pointer ${
                paperWidth === '80mm' ? 'bg-white text-black' : 'text-neutral-400'
              }`}
            >
              80mm (3")
            </button>
          </div>
        </div>

        {/* Scrollable Receipt Preview */}
        <div className="flex-1 overflow-y-auto py-4 custom-scrollbar flex justify-center bg-neutral-900/50 rounded-2xl my-2 p-2">
          {/* Printable White Thermal Slip Preview */}
          <div
            id="thermal-receipt-printable"
            style={{ width: paperWidth === '58mm' ? '280px' : '360px' }}
            className="bg-white text-black font-mono p-4 rounded-xl shadow-2xl text-[11px] leading-tight select-text"
          >
            {printMode === 'kitchen_kot' ? (
              // KOT Preview
              <div className="space-y-2">
                <div className="text-center pb-2 border-b-2 border-black border-dashed">
                  <p className="text-sm font-black uppercase tracking-wider bg-black text-white py-0.5 px-2 rounded-sm inline-block">
                    ★ JIKONI / KOT ★
                  </p>
                  <p className="text-[10px] font-bold mt-1">{vendorName}</p>
                </div>

                {tableNum ? (
                  <div className="text-center py-1 bg-neutral-100 rounded border border-neutral-300">
                    <p className="text-lg font-black uppercase">MEZA #{tableNum}</p>
                  </div>
                ) : (
                  <div className="text-center py-1">
                    <p className="text-xs font-black uppercase">{order.orderType?.toUpperCase() || 'WALK-IN'}</p>
                  </div>
                )}

                <div className="flex justify-between text-[10px] border-b border-black border-dashed pb-1">
                  <span>Oda: #{orderId}</span>
                  <span>{new Date().toLocaleTimeString('sw-TZ', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                <div className="py-2 space-y-2">
                  {items.map((it: any, idx: number) => (
                    <div key={idx} className="border-b border-neutral-200 pb-1">
                      <div className="flex justify-between font-black text-xs">
                        <span>{it.quantity || 1}x {it.name || it.productName}</span>
                      </div>
                      {it.selectedAddons?.length > 0 && (
                        <p className="text-[9.5px] text-neutral-600 pl-3">
                          + {it.selectedAddons.join(', ')}
                        </p>
                      )}
                      {(it.notes || it.specialInstructions) && (
                        <p className="text-[9.5px] font-bold bg-neutral-100 p-1 rounded mt-0.5 text-neutral-800">
                          ⚠️ {it.notes || it.specialInstructions}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="pt-2 text-center text-[9px] text-neutral-600 border-t border-black border-dashed">
                  PAPO HAPO KITCHEN AUTOMATION
                </div>
              </div>
            ) : (
              // Customer Bill Preview
              <div className="space-y-2">
                <div className="text-center pb-2 border-b border-black border-dashed space-y-0.5">
                  <p className="text-xs font-black uppercase tracking-tight">{vendorName}</p>
                  <p className="text-[9.5px] text-neutral-600">{vendor.address || 'Tanzania'}</p>
                  <p className="text-[9.5px] text-neutral-600">Simu: {vendorPhone}</p>
                </div>

                <div className="text-center py-1 border-b border-black border-dashed">
                  <p className="text-xs font-black uppercase tracking-wider">
                    {tableNum ? `RISITI YA MEZA #${tableNum}` : 'STAKABADHI YA MALIPO'}
                  </p>
                  <div className="flex justify-between text-[9.5px] text-neutral-600 mt-1">
                    <span>Oda: #{orderId}</span>
                    <span>{new Date().toLocaleDateString('sw-TZ', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  {order.customerName && (
                    <p className="text-left text-[9.5px] text-neutral-700 mt-0.5">
                      Mteja: {order.customerName}
                    </p>
                  )}
                </div>

                {/* Items Table */}
                <div className="py-2 space-y-1">
                  <div className="flex justify-between font-black text-[9.5px] border-b border-neutral-300 pb-0.5">
                    <span>BIDHAA</span>
                    <span>BEI (TZS)</span>
                  </div>
                  {items.map((it: any, idx: number) => {
                    const lineTotal = (it.price || 0) * (it.quantity || 1);
                    return (
                      <div key={idx} className="flex justify-between text-[10px]">
                        <span className="truncate pr-1">{it.quantity || 1}x {it.name || it.productName}</span>
                        <span className="font-bold shrink-0">{lineTotal.toLocaleString()}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Financials */}
                <div className="border-t border-black border-dashed pt-1.5 space-y-1 text-[10px]">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>TZS {subtotal.toLocaleString()}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between font-bold">
                      <span>Punguzo ({order.couponCode || 'Ofa'}):</span>
                      <span>-TZS {discount.toLocaleString()}</span>
                    </div>
                  )}
                  {order.deliveryFee > 0 && (
                    <div className="flex justify-between">
                      <span>Usafiri:</span>
                      <span>TZS {order.deliveryFee.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-black text-xs border-t-2 border-black pt-1">
                    <span>JUMLA KUU:</span>
                    <span>TZS {total.toLocaleString()}</span>
                  </div>
                </div>

                {/* Payment status badge */}
                <div className="text-center pt-2 border-t border-black border-dashed space-y-1">
                  <p className="text-[10px] font-black uppercase">
                    {order.paymentStatus === 'paid' ? '★★★ LIMELIPWA (PAID) ★★★' : '⏳ INASUBIRI MALIPO'}
                  </p>
                  <p className="text-[8.5px] text-neutral-600">
                    Asante kwa kutuchagua! Karibu tena!
                  </p>
                  <p className="text-[8px] text-neutral-500">
                    Powered by Papo Hapo Super App
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-3 border-t border-neutral-800 shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Button
            type="button"
            onClick={handleBrowserPrint}
            className="bg-white hover:bg-neutral-200 text-black font-black uppercase text-xs rounded-xl h-11 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Printer className="w-4 h-4" /> Chapa (Print)
          </Button>

          <Button
            type="button"
            onClick={handleBluetoothPrint}
            disabled={isBluetoothPrinting}
            className="bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-xs rounded-xl h-11 cursor-pointer flex items-center justify-center gap-1.5"
          >
            {isBluetoothPrinting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Bluetooth className="w-4 h-4" />
            )}
            Bluetooth
          </Button>

          <Button
            type="button"
            onClick={handleShareWhatsApp}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-xs rounded-xl h-11 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Share2 className="w-4 h-4" /> WhatsApp Mteja
          </Button>

          <Button
            type="button"
            onClick={handleSendKitchenWhatsApp}
            className="bg-amber-600 hover:bg-amber-500 text-black font-black uppercase text-xs rounded-xl h-11 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Utensils className="w-4 h-4 text-black" /> Jikoni WA
          </Button>
        </div>
      </motion.div>
    </div>
  );
};
