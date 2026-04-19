import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:lucide_icons_flutter/lucide_icons_flutter.dart';
import '../../controllers/pos_controller.dart';
import '../../models/product_model.dart';

class PosPage extends StatelessWidget {
  const PosPage({super.key});

  @override
  Widget build(BuildContext context) {
    final posCtrl = Get.find<PosController>();

    return Row(
      children: [
        // Left Panel: Products & Quick Actions
        Expanded(
          flex: 3,
          child: Container(
            padding: const EdgeInsets.all(32),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Point of Sale (Mfumo wa Mauzo)', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                const SizedBox(height: 24),
                // Search Bar
                TextField(
                  onChanged: (v) => posCtrl.searchQuery.value = v,
                  decoration: InputDecoration(
                    hintText: 'Tafuta bidhaa au scan barcode...',
                    prefixIcon: const Icon(LucideIcons.search, size: 20),
                    filled: true,
                    fillColor: const Color(0xFF141414),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
                  ),
                ),
                const SizedBox(height: 32),
                const Text('Vitu vinavyouzikwa zaidi (Quick Actions)', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey)),
                const SizedBox(height: 16),
                // Quick Actions Grid
                SizedBox(
                  height: 120,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: posCtrl.quickActions.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 16),
                    itemBuilder: (context, index) {
                      final p = posCtrl.quickActions[index];
                      return _QuickActionCard(product: p);
                    },
                  ),
                ),
                const SizedBox(height: 40),
                const Text('Bidhaa Zote', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey)),
                const SizedBox(height: 16),
                // Inventory Grid
                Expanded(
                  child: GridView.builder(
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 3,
                      crossAxisSpacing: 16,
                      mainAxisSpacing: 16,
                      childAspectRatio: 0.8,
                    ),
                    itemCount: posCtrl.quickActions.length * 2, // Dummy count
                    itemBuilder: (context, index) {
                      final p = posCtrl.quickActions[index % posCtrl.quickActions.length];
                      return _ProductCard(product: p);
                    },
                  ),
                ),
              ],
            ),
          ),
        ),
        
        // Right Panel: Cart & Checkout
        Container(
          width: 400,
          decoration: BoxDecoration(
            color: const Color(0xFF141414),
            border: Border(left: BorderSide(color: Colors.white.withOpacity(0.05))),
          ),
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.all(24),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Kikapu cha Oda', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                    IconButton(onPressed: posCtrl.clearCart, icon: const Icon(LucideIcons.trash2, color: Colors.redAccent, size: 20)),
                  ],
                ),
              ),
              const Divider(color: Colors.white10),
              
              // Cart Items
              Expanded(
                child: Obx(() => ListView.builder(
                  padding: const EdgeInsets.all(24),
                  itemCount: posCtrl.cart.length,
                  itemBuilder: (context, index) {
                    final item = posCtrl.cart[index];
                    return _CartItemRow(item: item);
                  },
                )),
              ),
              
              // Totals
              Container(
                padding: const EdgeInsets.all(32),
                decoration: BoxDecoration(
                  color: Colors.black,
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
                ),
                child: Column(
                  children: [
                    _TotalRow(label: 'Jumla ya Bidhaa', value: Get.find<PosController>().subtotal),
                    _TotalRow(label: 'Kodi (VAT 18%)', value: Get.find<PosController>().tax),
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0xFFBCFF4B).withOpacity(0.1),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('TOTAL', style: TextStyle(fontWeight: FontWeight.black, fontSize: 20, color: Color(0xFFBCFF4B))),
                          Obx(() => Text(
                            'TZS ${Get.find<PosController>().total.toStringAsFixed(0)}',
                            style: const TextStyle(fontWeight: FontWeight.black, fontSize: 20, color: Color(0xFFBCFF4B)),
                          )),
                        ],
                      ),
                    ),
                    const SizedBox(height: 32),
                    SizedBox(
                      width: double.infinity,
                      height: 64,
                      child: ElevatedButton(
                        onPressed: () => _showPaymentModal(context),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFBCFF4B),
                          foregroundColor: Colors.black,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          elevation: 0,
                        ),
                        child: const Text('LIPA SASA (CHECKOUT)', style: TextStyle(fontWeight: FontWeight.black)),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  void _showPaymentModal(BuildContext context) {
    Get.bottomSheet(
      Container(
        padding: const EdgeInsets.all(32),
        decoration: const BoxDecoration(
          color: Color(0xFF141414),
          borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Chagua Njia ya Malipo', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 32),
            _PaymentMethodBtn(label: 'CASH (PESA TASLIMU)', icon: LucideIcons.banknote, color: Colors.green),
            const SizedBox(height: 16),
            _PaymentMethodBtn(label: 'M-PESA / TIGO PESA', icon: LucideIcons.smartphone, color: Colors.red),
            const SizedBox(height: 16),
            _PaymentMethodBtn(label: 'AIRTEL MONEY', icon: LucideIcons.phoneCall, color: Colors.redAccent),
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              height: 56,
              child: OutlinedButton(onPressed: () => Get.back(), child: const Text('Ghairi')),
            ),
          ],
        ),
      ),
    );
  }
}

class _QuickActionCard extends StatelessWidget {
  final Product product;
  const _QuickActionCard({required this.product});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => Get.find<PosController>().addToCart(product),
      child: Container(
        width: 120,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFF141414),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Colors.white.withOpacity(0.05)),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(LucideIcons.zap, color: Color(0xFFBCFF4B), size: 24),
            const SizedBox(height: 8),
            Text(product.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
          ],
        ),
      ),
    );
  }
}

class _ProductCard extends StatelessWidget {
  final Product product;
  const _ProductCard({required this.product});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Container(
              width: double.infinity,
              decoration: BoxDecoration(
                color: Colors.grey.withOpacity(0.05),
                borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
              ),
              child: const Center(child: Icon(LucideIcons.image, color: Colors.grey)),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(product.name, style: const TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 4),
                Text('TZS ${product.price.toStringAsFixed(0)} / ${product.unitLabel}', style: const TextStyle(color: Colors.grey, fontSize: 12)),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () => _showWeightPicker(context, product),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white10,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      elevation: 0,
                    ),
                    child: const Text('ONGEZA', style: TextStyle(fontSize: 12)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showWeightPicker(BuildContext context, Product product) {
    if (product.unit == ProductUnit.kg) {
      final TextEditingController weightCtrl = TextEditingController(text: '1.0');
      Get.defaultDialog(
        title: 'Ingiza Uzito (kg)',
        backgroundColor: const Color(0xFF141414),
        content: Column(
          children: [
            Text(product.name, style: const TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            TextField(
              controller: weightCtrl,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              autofocus: true,
              style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
              textAlign: TextAlign.center,
              decoration: const InputDecoration(suffixText: 'kg'),
            ),
          ],
        ),
        textConfirm: 'ONIGEZA',
        onConfirm: () {
          Get.find<PosController>().addToCart(product, qty: double.tryParse(weightCtrl.text) ?? 1.0);
          Get.back();
        },
      );
    } else {
      Get.find<PosController>().addToCart(product);
    }
  }
}

class _CartItemRow extends StatelessWidget {
  final CartItem item;
  const _CartItemRow({required this.item});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.product.name, style: const TextStyle(fontWeight: FontWeight.bold)),
                Text('${item.quantity} ${item.product.unitLabel} @ TZS ${item.product.price}', style: const TextStyle(color: Colors.grey, fontSize: 11)),
              ],
            ),
          ),
          Text('TZS ${item.totalPrice.toStringAsFixed(0)}', style: const TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(width: 8),
          IconButton(onPressed: () => Get.find<PosController>().removeFromCart(item), icon: const Icon(LucideIcons.x, size: 14, color: Colors.grey)),
        ],
      ),
    );
  }
}

class _TotalRow extends StatelessWidget {
  final String label;
  final double value;
  const _TotalRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.grey, fontSize: 13)),
          Obx(() => Text('TZS ${value.toStringAsFixed(0)}')),
        ],
      ),
    );
  }
}

class _PaymentMethodBtn extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;

  const _PaymentMethodBtn({required this.label, required this.icon, required this.color});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => Get.find<PosController>().processSale(label),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          border: Border.all(color: Colors.white10),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          children: [
            Icon(icon, color: color),
            const SizedBox(width: 16),
            Text(label, style: const TextStyle(fontWeight: FontWeight.bold)),
            const Spacer(),
            const Icon(LucideIcons.chevronRight, size: 16, color: Colors.grey),
          ],
        ),
      ),
    );
  }
}
