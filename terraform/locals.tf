# local ise variable'ın aksine kullanıcı tarafından dışarıdan değer ataması yapılmaz kod içinde hesaplanan veya ortak kullanılan değerlerdir.
locals {
  common_tags = {
    # bu etiketleri her Azure kaynağında tekrar yazmak yerine local.common_tags şeklinde kullanacağız.
    project     = "cloud-native-order-platform"
    environment = "lab"
    managed_by  = "terraform"
  }
}
