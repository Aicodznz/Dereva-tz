enum ProductUnit { kg, piece, pack, bunch, tray }

class Product {
  final String id;
  final String name;
  final String category;
  final double price;
  final ProductUnit unit;
  final double stock;
  final double lowStockThreshold;
  final String? imageUrl;

  Product({
    required this.id,
    required this.name,
    required this.category,
    required this.price,
    required this.unit,
    required this.stock,
    this.lowStockThreshold = 5,
    this.imageUrl,
  });

  String get unitLabel {
    switch (unit) {
      case ProductUnit.kg: return 'kg';
      case ProductUnit.piece: return 'pc';
      case ProductUnit.pack: return 'pk';
      case ProductUnit.bunch: return 'bunch';
      case ProductUnit.tray: return 'tray';
    }
  }
}

class CartItem {
  final Product product;
  double quantity;

  CartItem({required this.product, this.quantity = 1.0});

  double get totalPrice => product.price * quantity;
}
