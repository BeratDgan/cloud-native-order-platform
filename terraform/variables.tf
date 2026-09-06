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

variable "external_secrets_identity_name" {
  description = "External Secrets için kullanılacak managed identity adı"
  type        = string
  # burada ilk defa default kullandım bu da terraform.tfvars dosyasında değer verirse o kullanılır vermezse buradaki defaul değer kullanıır.
  default = "id-external-secrets-aks-lab"
}
