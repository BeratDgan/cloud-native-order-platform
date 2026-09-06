# Burada data olarak vermemin sebebi halihazırda azure'da oluşturduğum resource group'u kullanmak için.
data "azurerm_resource_group" "lab" {
  name = var.resource_group_name
}
data "azurerm_container_registry" "platform" {
  name                = var.acr_name
  resource_group_name = data.azurerm_resource_group.lab.name
}
data "azurerm_key_vault" "platform" {
  name                = var.key_vault_name
  resource_group_name = data.azurerm_resource_group.lab.name
}
