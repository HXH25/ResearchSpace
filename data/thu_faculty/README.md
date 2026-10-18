# 清华大学公开官网教师资料（不含 SRT 数据）

来源范围：清华大学公开官网的教师、研究者资料。该库包含可核对来源链接的公开科研信息，用于离线导师检索、OpenAlex 配合搜索与科研联系模块。

- 保留 `faculty.sqlite` 中的 **4,026 条教师来源资料**及公开研究方向等字段。
- 已清除 **所有 SRT 项目编号及项目关联**（`profile_json.srt_project_ids`、导师匹配数据表、项目关联表、单位中 SRT 统计标记）。SQLite 已清理并重新压缩，以免原记录留在数据库空闲页中。
- `srt_mentor_matches`、`srt_project_links` 只保留**空表结构**以兼容原有内部数据接口，`departments.srt_priority` 清零为空值。
- 用户自行导入 SRT 后，原有项目搜索、导入、筛选和详情接口可用；但没有历史强关联清单时，不会自动恢复原来的项目—导师配对关系。
- `summary.json`、`data_dictionary.json`、`validation_report.json` 为本公开版元数据，已移除 SRT 来源统计；仅附带对实际保留文件重新生成的校验值。

这不是大学教师总名册；若据此联系研究者，需打开来源官网核对任职与研究内容。
