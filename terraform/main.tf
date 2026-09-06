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

# bu defa data yerine resource kullandım çünkü azure'da henüz oluşturmadığım bir managed identity oluşturmak için.
resource "azurerm_user_assigned_identity" "external_secrets" {
  name                = var.external_secrets_identity_name
  location            = data.azurerm_resource_group.lab.location
  resource_group_name = data.azurerm_resource_group.lab.name
  tags                = local.common_tags
}

# azurerm_role_assignment resource'u ile managed identity'ye key vault üzerinde secret okuma
resource "azurerm_role_assignment" "external_secrets_key_vault" {
  principal_id                     = azurerm_user_assigned_identity.external_secrets.principal_id # yetkiyi hangi id ye vereceğimizi belirtir.
  role_definition_name             = "Key Vault Secrets User"                                     # secret değerleri okuyabilir fakat yazamaz.
  scope                            = data.azurerm_key_vault.platform.id                           # yetki sadece bu key vault üzerinde geçerli olacak.
  principal_type                   = "ServicePrincipal"
  skip_service_principal_aad_check = true
}
