# Terraform tek başına Azure’u yönetemez. azurerm isimli provider, Terraform ile Azure API arasında çevirmen gibi çalışır
terraform {
  required_version = ">= 1.10.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 5.2.0"
    }
  }
}

provider "azurerm" {
  features {}

  subscription_id = var.subscription_id
}