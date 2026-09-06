variable "subscription_id" {
  description = "Azure kaynaklarinin olusturulacagi subscription ID"
  type        = string
}
variable "resource_group_name" {
  description = "Mevcut Azure resource group adi"
  type        = string
}
variable "acr_name" {
  description = "Azure Container Registry adi"
  type        = string
}
variable "key_vault_name" {
  description = "Azure Key Vault adi"
  type        = string
}