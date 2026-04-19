import 'package:get/get.dart';
import '../models/product_model.dart';

class ProductController extends GetxController {
  var products = <Product>[].obs;
  var isLoading = false.obs;

  @override
  void onInit() {
    super.onInit();
    // Load initial data
    products.addAll([
      Product(id: '1', name: 'Nyanya Fresh', category: 'Mboga', price: 2000, unit: ProductUnit.kg, stock: 45),
      Product(id: '2', name: 'Mchele Safi', category: 'Nafaka', price: 2500, unit: ProductUnit.kg, stock: 120),
    ]);
  }

  void addProduct(Product product) {
    products.add(product);
    Get.back();
    Get.snackbar('Hifadhi', 'Bidhaa imeongezwa kikamilifu!');
  }

  void updateStock(String id, double quantity) {
    var index = products.indexWhere((p) => p.id == id);
    if (index != -1) {
      // In real app, write to Firestore
      Get.snackbar('Stock Update', 'Stock for ${products[index].name} updated.');
    }
  }
}
