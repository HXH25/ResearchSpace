# 与科研项目模块交接

宿主冻结 SDK 的基础导航已可直接使用：

```ts
api.navigation.go('/app/outreach?facultyId=' + encodeURIComponent(faculty.id));
api.navigation.go('/app/outreach?opportunityId=' + encodeURIComponent(opportunity.id));
```

邮件模块只通过 `api.catalog.getFacultyById` / `getOpportunityById` 读取公共记录，不跨模块读取私有存储。主程序的 `OpportunityRecord` 没有细粒度联系政策、用户资格结论；因此不能仅靠基础 SDK 的 `eligibility` 枚举宣布具体用户具备资格。

## 详细交接文件

沿用已有 `research-opportunities/0.1` 的 `EmailModuleHandoff`，在外层显式绑定宿主版本与证据：

```ts
{
  kind: 'researchspace-outreach-handoff/1',
  profileUpdatedAt: profile.updatedAt,
  opportunityId: hostCatalogOpportunityId,
  sources: publicEvidenceConvertedToHostEvidenceSource,
  handoff: legacyEmailModuleHandoff
}
```

`profileUpdatedAt` 必须由项目模块在资格评估时捕获，不能在读到旧交接后默默替换为最新值。遗留数字 `profileVersion` 与 SDK `updatedAt` 不是同一类型，本模块不会猜测换算。可使用 `examples/handoffEnvelope.ts`，传入**资格评估实际使用**的宿主画像时间。

用户在“导入项目模块交接”中选择 JSON 文件，文件只在本地解析。解析验证：

1. 外层版本、来源格式、字段类型；内层 `schemaVersion`、`deliveryMode:'draft_only'`。
2. `profileRef.ownerUserId` 与 `qualification.profileRef.ownerUserId` 都属于当前账号。
3. 资格结论与交接使用相同的数字画像版本及 profileId，外层时间等于当前 `profile.updatedAt`。
4. `requestedAt` 7 天以内；项目必须在宿主目录存在，`opportunityId` 必须匹配。
5. `contactGate` 为 allowed；联系政策允许直接联系；官方证据覆盖允许 route 的联系人。
6. 如生成正式申请，资格必须 eligible，route 必须在 `allowedApplicationRouteIds` 中，宿主项目记录还须满足当前开放与截止时间检查。

`contactPolicy.rules` 中针对目标角色和目的的 prohibited 优先于一般允许。由于本版使用保守联系策略，`portal_only`、`no_direct_contact` 都直接引导回官方渠道，不通过其他目的绕过。

内层交接通常没有招募 status。本模块始终从宿主 `OpportunityRecord` 独立读取；缺失或 unknown 不变成 open。内层 `inferredFit`、`studentProvidedFacts`、`projectFacts` 不会自动进入邮件，避免旧版本画像或未解析证据在跨模块时升级成事实。采用的个人字段仍需当前用户重新勾选；项目名称来自当前目录。

外层来源使用 SDK `EvidenceSource`，每个 id 需要覆盖内层 `recipients[].evidenceIds`。进入草稿快照时按 `faculty:`、`project:`、`handoff:` 前缀区分来源 ID，防止不同记录的局部 ID 冲突。

官方联系人有多个时，用户应自行填入其中与姓名相符的邮箱并核对身份。系统不会自动对所有联系人逐一生成或发送邮件。
