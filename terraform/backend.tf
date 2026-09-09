# bu backend dosyası sayesinde terraform state dosyasını Azure Storage Account üzerinde tutuyorum. Bu sayede state dosyası versionlanabilir ve birden fazla kişi aynı anda terraform apply yapabilir.
# terraform state dosyası, terraform plan ve terraform apply gibi komutlar çalıştırıldığında oluşan geçici dosyalar ve diğer metadata bilgilerini içerir. Bu dosya, Terraform'un mevcut altyapı durumunu takip etmesine ve değişiklikleri yönetmesine yardımcı olur.

terraform {
  backend "azurerm" {
    storage_account_name = "stberattfstate0"
    container_name       = "tfstate"
    key                  = "cloud-native-lab.tfstate"
    use_azuread_auth     = true
    use_cli              = true

  }
}