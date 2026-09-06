# output sayesinde seçtiğimiz bilgileri terminalde görülebilri hale getirdim.
# ouutput azure kayanğı oluşturmaz sadece terraformun bildiği değerleri terminalde görmemizi sağlar.
output "resource_group_id" {
  description = "Terraform tarafindan okunan resource group ID"
  value       = data.azurerm_resource_group.lab.id
}
output "resource_group_location" {
  description = " resource group'un  azure daki lokasyonu"
  value       = data.azurerm_resource_group.lab.location
}
output "acr_login_server" {
  description = "Container image adreslerinde kullanılacak ACR sunucusu"
  value       = data.azurerm_container_registry.platform.login_server
}

output "key_vault_uri" {
  description = "External Secrets tarafından kullanılacak Key Vault adresi"
  value       = data.azurerm_key_vault.platform.vault_uri
}
