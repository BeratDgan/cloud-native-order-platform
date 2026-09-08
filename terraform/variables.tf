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
variable "aks_name" {
  description = "Azure Kubernetes Service cluster adi"
  type        = string
  default     = "aks-cloud-native-lab"
}

variable "kubernetes_version" {
  description = "AKS Kubernetes major ve minor surumu"
  type        = string
  default     = "1.35"
}

variable "system_node_vm_size" {
  description = "AKS system node pool VM boyutu"
  type        = string
}

variable "system_node_count" {
  description = "AKS system node sayisi"
  type        = number
  # Bu ortam production değildir.
  # Abonelikteki 4 vCPU kotası nedeniyle tek node kullanılmaktadır.
  validation {
    condition     = var.system_node_count >= 1
    error_message = "AKS system node pool en az bir node içermelidir."
  }
}

# free tier aks location'larında northeurope bulunmadığı için aks cluster'ı swedencenter bölgesine taşıdım
variable "aks_location" {
  description = "AKS cluster'in kurulacagi Azure bolgesi"
  type        = string
}