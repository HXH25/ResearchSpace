CREATE TABLE projects ("academic_term" TEXT, "applicant" TEXT, "batch" INTEGER, "category" TEXT, "department" TEXT, "detail_state" TEXT NOT NULL CHECK(detail_state IN ('collected','pending')), "initiation_type" TEXT NOT NULL CHECK(initiation_type IN ('teacher','student')), "project_id" TEXT PRIMARY KEY, "status" TEXT, "title" TEXT, "mentor" TEXT);

CREATE TABLE project_details ("project_id" TEXT PRIMARY KEY, "budget" TEXT, "capacity" TEXT, "category" TEXT, "credits" TEXT, "department" TEXT, "description" TEXT, "eligibility" TEXT, "end_month" TEXT, "expected_outcomes" TEXT, "funding_requested" TEXT, "mentor" TEXT, "mentor_awards" TEXT, "mentor_experience" TEXT, "mentor_team" TEXT, "mentor_title" TEXT, "other_funding" TEXT, "resources" TEXT, "schedule" TEXT, "start_month" TEXT, "title" TEXT, "academic_term" TEXT, "batch" INTEGER, "status" TEXT, "collected_at" TEXT, "source_access" TEXT, "source_project_id" TEXT, "list_title" TEXT, "title_differs_from_list" INTEGER, "initiation_type" TEXT NOT NULL CHECK(initiation_type IN ('teacher','student')), "applicant" TEXT, "mentor_department" TEXT, "list_applicant" TEXT, "list_department" TEXT, "applicant_class" TEXT, "applicant_experience_awards" TEXT, FOREIGN KEY(project_id) REFERENCES projects(project_id));

CREATE INDEX projects_department ON projects(department);

CREATE INDEX projects_initiation_type ON projects(initiation_type);

CREATE INDEX projects_applicant ON projects(applicant);

CREATE INDEX projects_mentor ON projects(mentor);

CREATE VIEW pending_projects AS SELECT * FROM projects WHERE detail_state='pending';
