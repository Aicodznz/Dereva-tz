import 'package:get/get.dart';
import '../models/product_model.dart';

class PosController extends GetxController {
  var cart = <CartItem>[].obs;
  var searchQuery = ''.obs;
  
  // Example Quick Actions
  var quickActions = <Product>[
    Product(id: '1', name: 'Nyanya', category: 'Mboga', price: 2000, unit: ProductUnit.kg, stock: 50),
    Product(id: '2', name: 'Vitunguu', category: 'Mboga', price: 3500, unit: ProductUnit.kg, stock: 30),
    Product(id: '3', name: 'Mchele Kyela', category: 'Nafaka', price: 2800, unit: ProductUnit.kg, stock: 100),
    Product(id: '4', name: 'Mafuta ya Kula', category: 'Vinywaji', price: 5000, unit: ProductUnit.piece, stock: 20),
    Product(id: '5', name: 'Sukari', category: 'Nafaka', price: 3000, unit: ProductUnit.kg, stock: 80),
  ].obs;

  double get subtotal => cart.fold(0, (sum, item) => sum + item.totalPrice);
  double get tax => subtotal * 0.18;
  double get total => subtotal + tax;

  void addToCart(Product product, {double qty = 1.0}) {
    var existing = cart.firstWhereOrNull((item) => item.product.id == product.id);
    if (existing != null) {
      existing.quantity += qty;
      cart.refresh();
    } else {
      cart.add(CartItem(product: product, quantity: qty));
    }
  }

  void removeFromCart(CartItem item) {
    cart.remove(item);
  }

  void clearCart() {
    cart.clear();
  }

  void processSale(String method) {
    // In a real app, update Firestore inventory here
    Get.snackbar(
      'Sale Completed',
      'Transaction successful via $method',
      snackPosition: SnackPosition.BOTTOM,
    );
    clearCart();
  }
}
