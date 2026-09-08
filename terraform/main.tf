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


# Burada asıl compute resource olan AKS cluster'ı oluşturuyorum
resource "azurerm_kubernetes_cluster" "platform" {
  name                = var.aks_name
  location            = var.aks_location
  resource_group_name = data.azurerm_resource_group.lab.name
  node_resource_group = "${var.resource_group_name}-aks-nodes"
  dns_prefix          = var.aks_name
  kubernetes_version  = var.kubernetes_version

  # sku_tier ile AKS master node'u free tier olur.
  sku_tier = "Free"
  # burada erişim kontrolü için role based access control ve workload identity kullanacağımı belirttim.
  role_based_access_control_enabled = true
  # oidc issuer_enabled ve workload_identity_enabled true yapmamın sebebi azure'da workload identity kullanmak için gerekli olan ayarları açmak.
  oidc_issuer_enabled       = true
  workload_identity_enabled = true
  local_account_disabled    = false

  node_os_upgrade_channel = "None"

  identity {
    type = "SystemAssigned"
  }

  # burada node pool oluşturuyorum ve node pool için gerekli ayarları yapıyorum.
  # node pool, AKS cluster'ında bir veya daha fazla node grubunu temsil eden bir yapılandırmadır. Her node pool, belirli bir VM boyutu, disk türü ve diğer özelliklerle yapılandır
  default_node_pool {
    name                   = "system"
    vm_size                = var.system_node_vm_size
    node_count             = var.system_node_count
    auto_scaling_enabled   = false
    max_pods               = 50
    os_disk_size_gb        = 64
    os_disk_type           = "Managed"
    os_sku                 = "Ubuntu"
    type                   = "VirtualMachineScaleSets"
    node_public_ip_enabled = false

    upgrade_settings {
      # max surge yüzde 10 ayarlanarak güncelleme sırasında aynı anda maksimum %10 node'un güncellenebileceğini belirtiyor.
      max_surge = "10%"
    }
  }

  node_provisioning_profile {
    mode = "Manual"
  }

  # burada network profile oluşturuyorum ve network profile için gerekli ayarları yapıyorum.
  # network profile, AKS cluster'ının ağ yapılandırmasını belirler. Bu yapılandırma, ağ eklentisi, ağ politikası ve diğer ağ özelliklerini içerir.
  network_profile {
    network_plugin      = "azure"
    network_plugin_mode = "overlay"
    network_data_plane  = "cilium"
    network_policy      = "cilium"
    load_balancer_sku   = "standard"
    outbound_type       = "loadBalancer"

    pod_cidr       = "10.244.0.0/16"
    service_cidr   = "10.0.0.0/16"
    dns_service_ip = "10.0.0.10"
  }

  tags = local.common_tags
}

# bu resource sayesinde AKS cluster'ının kubelet identity'sine ACR pull yetkisi veriyorum. Bu sayede AKS cluster'ı ACR'den container image çekebilir.
resource "azurerm_role_assignment" "aks_acr_pull" {
  scope                            = data.azurerm_container_registry.platform.id
  role_definition_name             = "AcrPull"
  principal_id                     = azurerm_kubernetes_cluster.platform.kubelet_identity[0].object_id
  principal_type                   = "ServicePrincipal"
  skip_service_principal_aad_check = true
}

# AKS OIDC issuer ile External Secrets managed identity arasında güven ilişkisi oluşturur.
# Yalnızca demo namespace'indeki external-secrets-key-vault ServiceAccount bu identity'yi kullanabilir.s
resource "azurerm_federated_identity_credential" "external_secrets" {
  name                      = "fic-external-secrets-aks-lab"
  user_assigned_identity_id = azurerm_user_assigned_identity.external_secrets.id
  audience                  = ["api://AzureADTokenExchange"]
  issuer                    = azurerm_kubernetes_cluster.platform.oidc_issuer_url
  subject                   = "system:serviceaccount:demo:external-secrets-key-vault"
}
