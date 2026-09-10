# Velero ile AKS backup ve restore

Bu aşamada PostgreSQL StatefulSet'in `managed-csi` diski Velero ile Azure Disk
snapshot'ına alınır; backup metadata'sı ayrı bir Azure Blob container'da tutulur.
Canlı namespace veya veritabanı silinmeden, yalnızca PVC `demo-dr` namespace'ine
geri yüklenerek felaket senaryosu doğrulanır.

## Mimari

```text
Velero ServiceAccount
        │ OIDC federation (secret/client key yok)
        ▼
Azure Managed Identity ── RBAC ──► private Blob container
        │
        └── EnableCSI ──► Azure Disk incremental snapshot
```

Terraform şu kaynakları yönetir:

- Standard LRS `stberatveleroaks` Storage Account ve private `velero-backups` container
- `id-velero-aks-lab` user-assigned managed identity
- Storage Blob Data Contributor ve Reader rolleri
- Yalnızca `system:serviceaccount:velero:velero` için federated credential

Storage key ve client secret kullanılmaz. PostgreSQL Secret'ı `app=postgresql`
etiketine sahip olmadığı için backup seçicisine girmez; parola Azure Key Vault'ta
kalır. Gerçek bir yeni-cluster kurtarmasında önce External Secrets bağlantısı ayağa
kaldırılır, sonra PostgreSQL workload başlatılır.

Velero Helm kurulumu `EnableCSI` özelliğini ve `disk.csi.azure.com` için incremental,
`Retain` politikalı bir `VolumeSnapshotClass` oluşturur. `postgresql-daily` schedule
her gün 02:00'de backup alır ve yedi gün saklar.

## Güvenli felaket testi

On-demand backup manifesti yalnızca `demo` namespace'indeki `app=postgresql`
etiketli kaynakları seçer:

```bash
kubectl --context aks-cloud-native-lab apply \
  -f ops/velero/postgresql-backup.yaml

kubectl --context aks-cloud-native-lab -n velero get backup
kubectl --context aks-cloud-native-lab -n demo get volumesnapshot
```

Backup `Completed` ve snapshot `READYTOUSE=true` olduktan sonra yalnızca PVC ayrı
namespace'e geri yüklenir:

```bash
kubectl --context aks-cloud-native-lab apply \
  -f ops/velero/demo-dr-namespace.yaml
kubectl --context aks-cloud-native-lab apply \
  -f ops/velero/postgresql-restore.yaml

kubectl --context aks-cloud-native-lab -n velero get restore
kubectl --context aks-cloud-native-lab -n demo-dr get pvc
```

Verifier pod geri dönen diski read-only mount eder; parola kullanmadan PostgreSQL
cluster dosyalarının bulunduğunu kanıtlar:

```bash
kubectl --context aks-cloud-native-lab apply \
  -f ops/velero/restore-verifier.yaml
kubectl --context aks-cloud-native-lab -n demo-dr logs \
  postgresql-restore-verifier
```

Beklenen çıktı `RESTORE_OK` ile başlar. Bu CSI snapshot crash-consistent bir altyapı
yedeğidir; üretimde transaction tutarlılığı için PostgreSQL native backup/WAL
arşivleme ile birlikte kullanılmalıdır.

## Screenshot rehberi

1. `44-velero-backup-and-snapshot.png`: aynı terminalde Backup `Completed`,
   BackupStorageLocation `Available` ve VolumeSnapshot `READYTOUSE=true`.
2. `45-velero-restore-verification.png`: Restore `Completed`, `demo-dr` PVC `Bound`
   ve verifier logunda `RESTORE_OK`.
3. Azure Portal → Storage Account → Containers → `velero-backups`: backup klasörü;
   hesap kimliği ve gereksiz subscription ayrıntıları kırpılmalı.

Test kanıtı alındıktan sonra geçici namespace silinebilir:

```bash
kubectl --context aks-cloud-native-lab delete namespace demo-dr
```
