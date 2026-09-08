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

output "external_secrets_identity_client_id" {
  description = "Kubernetes ServiceAccount annotation için kullanilacak client ID"
  value       = azurerm_user_assigned_identity.external_secrets.client_id
}

output "external_secrets_identity_principal_id" {
  description = "Azure RBAC islemlerinde kullanilan principal ID"
  value       = azurerm_user_assigned_identity.external_secrets.principal_id
}

output "aks_name" {
  description = "Oluşturulan AKS cluster adı"
  value       = azurerm_kubernetes_cluster.platform.name
}

output "aks_node_resource_group" {
  description = "AKS node ve ağ kaynaklarının bulunduğu Azure-managed resource group"
  value       = azurerm_kubernetes_cluster.platform.node_resource_group
}

output "aks_oidc_issuer_url" {
  description = "Workload Identity tarafından kullanılan AKS OIDC issuer"
  value       = azurerm_kubernetes_cluster.platform.oidc_issuer_url
}

output "aks_connect_command" {
  description = "AKS kubeconfig bağlantı komutu"
  value       = "az aks get-credentials --resource-group ${var.resource_group_name} --name ${var.aks_name} --overwrite-existing"
}

output "aks_stop_command" {
  description = "Kullanılmadığında AKS cluster'ını durdurma komutu"
  value       = "az aks stop --resource-group ${var.resource_group_name} --name ${var.aks_name}"
}

output "aks_start_command" {
  description = "Durdurulan AKS cluster'ını başlatma komutu"
  value       = "az aks start --resource-group ${var.resource_group_name} --name ${var.aks_name}"
}