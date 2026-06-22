export function getPreviewApiResponse(path: string): unknown {
  const now = "2026-06-07T18:40:00Z";

  const profile = {
    birth_date: "1993-04-12",
    current_status: "BC 거주 중",
    target_route: "BC PNP",
    education_level: "학사",
    eca_status: true,
    language_score: "CLB 8",
    language_test: "IELTS",
    work_experience_years: "5",
    canadian_experience_years: "8개월",
    foreign_experience_years: "3년",
    noc_teer: "21231",
    french_score: "0",
    ee_category_interest: "STEM",
    ee_profile_status: "제출됨",
    ee_profile_notes: "공개 미리보기 상태",
    arranged_employment: false,
    employer_support: true,
    bc_pnp_stream_interest: "Tech",
    bc_pnp_category_interest: "고경제적 영향",
    bc_connection_type: "잡오퍼",
    bc_connection: "고용주 지원",
    bc_job_offer: "Yes",
    bc_occupation_focus: "기술/소프트웨어",
    province_nomination_interest: true,
    profile_notes: "디자인 QA용 미리보기 상태입니다.",
  };

  const routeProfiles = {
    bc_pnp: {
      route: "BC PNP",
      score: 58,
      fit_label: "가능 · 주의",
      fit_tone: "warn",
      ready: false,
      summary: "BC PNP Skills Immigration이 가장 유력하지만 언어와 직업군 확인이 필요합니다.",
      focus: "BC 연결 / 스트림 / 카테고리",
      drivers: ["BC 연결", "직업군 적합", "고용주 지원"],
      signals: ["상승 흐름", "적은 막힘"],
      missing_requirements: ["영어 CLB", "직업군 확인"],
    },
    express_entry: {
      route: "Express Entry",
      score: 34,
      fit_label: "약함",
      fit_tone: "bad",
      ready: false,
      summary: "현재는 약하지만 캐나다 경력과 언어 개선 이후 다시 볼 가치가 있습니다.",
      focus: "CRS / 언어 / 경력",
      drivers: ["언어", "캐나다 경력", "프랑스어"],
      signals: ["카테고리 관찰", "프로필 유효"],
      missing_requirements: ["영어 CLB", "1년 CEC"],
    },
  };

  const missingRequirements = [
    { title: "영어 CLB", body: "텍스트 줄바꿈과 계층을 확인합니다." },
    { title: "직업군", body: "채워진 상태의 레이아웃을 확인합니다." },
    { title: "고용주 지원", body: "버튼과 칩 스타일을 확인합니다." },
  ];

  const baseProfile: any = {
    profile_schema_version: 3,
    age: 33,
    age_basis: "birth_date: 1993-04-12 · Vancouver 기준 2026-06-07",
    profile_complete: false,
    fit_label: "프로필 필요",
    fit_tone: "warn",
    current_status: "신청자",
    strongest_route: "BC PNP",
    main_blocker: "영어 CLB",
    next_milestone: "다음 카테고리 창 점검",
    next_action: "프로필을 연결하면 개인 경로 분석이 열립니다.",
    main_status: "프로필 연결 전에는 공개 대시보드만 보입니다.",
    position_explanation: "이 미리보기는 공개 신호 층을 보여줍니다. 개인 적합도, 막힘, 경로 비교는 프로필이 추가되면 열립니다.",
    score: "58",
    score_potential: "74",
    score_drivers: ["언어", "경력", "BC 연결"],
    uncertainties: ["소스 시각", "카테고리 변동"],
    missing_requirements: missingRequirements,
    route_profiles: routeProfiles,
    profile,
    updated_at: now,
  };

  baseProfile.computed_scores = {
    locked: true,
    crs: {
      score: null,
      status: "잠금",
      confidence: 24,
      basis: ["영어 CLB", "학력/ECA-WES", "캐나다 경력"],
      missing: missingRequirements,
    },
    bc_pnp: {
      fit_score: null,
      status: "잠금",
      estimated_registration_range: null,
      confidence: 24,
      basis: ["직업군/TEER", "BC 잡오퍼", "고용주 지원", "BC 연결 유형", "학력/경력/언어"],
      missing: routeProfiles.bc_pnp.missing_requirements.map((title) => ({ title, body: title })),
    },
    comparison: {
      closer_route: null,
      express_entry_fit: null,
      bc_pnp_fit: null,
      next_action: "프로필을 저장하면 자동 CRS와 BC PNP 적합도가 열립니다.",
    },
  };

  switch (path) {
    case "/api/summary":
      return {
        source_count: 4,
        change_count: 12,
        record_count: 128,
        structured_record_count: 96,
        unstructured_record_count: 32,
        quality_score: 92,
        needs_review_count: 3,
        latest_snapshot: "2026.06.07 18:40",
        latest_change: {
          title: "BC PNP update",
          change_type: "policy",
          impact_level: "high",
          needs_review: 1,
          summary_ko: "BC PNP 카테고리 신호가 일부 강화되었습니다.",
          reasoning_ko: "최근 업데이트에서 Tech / High Economic Impact 관련 신호가 더 뚜렷해졌습니다.",
          detected_at: now,
          confidence: "high",
          source_id: "welcomebc",
          evidence_url: "https://example.com",
        },
        latest_record: {
          title: "BC PNP latest draw",
          record_type: "draw",
          event_date: "2026-06-07",
          program: "BC PNP",
          minimum_score: "102",
          invitations: "82",
          processing_time: "8-10 weeks",
          source_url: "https://example.com",
          data_basis_at: now,
        },
      };
    case "/api/source-health":
      return {
        source_count: 4,
        ok_count: 4,
        error_count: 0,
        unknown_count: 0,
        latest_checked_at: now,
        check_count: 31,
        sources: [
          {
            source_id: "welcomebc",
            title: "BC PNP Draws",
            publisher: "WelcomeBC",
            source_type: "official",
            program_tags: ["BC PNP"],
            last_checked_at: now,
            last_changed_at: now,
            status: "ok",
          },
          {
            source_id: "ircc",
            title: "IRCC Category Rounds",
            publisher: "IRCC",
            source_type: "official",
            program_tags: ["Express Entry"],
            last_checked_at: now,
            last_changed_at: now,
            status: "ok",
          },
          {
            source_id: "processing-time",
            title: "Processing Time",
            publisher: "IRCC",
            source_type: "official",
            program_tags: ["Processing time"],
            last_checked_at: now,
            last_changed_at: null,
            status: "ok",
          },
          {
            source_id: "policy-updates",
            title: "Policy Updates",
            publisher: "BC Gov",
            source_type: "official",
            program_tags: ["Policy"],
            last_checked_at: now,
            last_changed_at: now,
            status: "ok",
          },
        ],
      };
    case "/api/changes":
      return [
        {
          title: "BC PNP Tech category",
          change_type: "policy",
          impact_level: "high",
          needs_review: 1,
          summary_ko: "Tech 관련 흐름이 강화되었습니다.",
          reasoning_ko: "카테고리 초청이 더 자주 보입니다.",
          detected_at: now,
          confidence: "high",
          source_id: "welcomebc",
        },
        {
          title: "Processing time",
          change_type: "metric",
          impact_level: "medium",
          needs_review: 0,
          summary_ko: "처리 기간이 소폭 길어졌습니다.",
          reasoning_ko: "최근 평균 기간이 이전보다 증가했습니다.",
          detected_at: "2026-06-06T11:00:00Z",
          confidence: "medium",
          source_id: "processing-time",
        },
        {
          title: "French category",
          change_type: "trend",
          impact_level: "medium",
          needs_review: 0,
          summary_ko: "프랑스어 관련 신호가 유지됩니다.",
          reasoning_ko: "카테고리 기반 draw에서 관심도가 유지됩니다.",
          detected_at: "2026-06-05T10:30:00Z",
          confidence: "medium",
          source_id: "ircc",
        },
      ];
    case "/api/trends":
      return {
        record_count: 128,
        stream_count: 4,
        streams: [
          {
            label: "Tech",
            count: 28,
            metric_name: "minimum_score",
            metric_unit: "points",
            group_type: "bc_pnp",
            latest: {
              title: "BC PNP Tech draw",
              event_date: "2026-06-07",
              program: "BC PNP",
              stage: "Skills Immigration",
              minimum_score: "102",
              invitations: "82",
            },
            previous: {
              title: "BC PNP Tech draw",
              event_date: "2026-05-28",
              program: "BC PNP",
              stage: "Skills Immigration",
              minimum_score: "104",
              invitations: "76",
            },
            score_delta: -2,
            invitation_delta: 6,
            points: [],
          },
          {
            label: "Health",
            count: 16,
            metric_name: "minimum_score",
            metric_unit: "points",
            group_type: "bc_pnp",
            latest: {
              title: "Health draw",
              event_date: "2026-06-04",
              program: "BC PNP",
              stage: "Health",
              minimum_score: "106",
              invitations: "50",
            },
            previous: {
              title: "Health draw",
              event_date: "2026-05-22",
              program: "BC PNP",
              stage: "Health",
              minimum_score: "108",
              invitations: "45",
            },
            score_delta: -2,
            invitation_delta: 5,
            points: [],
          },
          {
            label: "French",
            count: 12,
            metric_name: "minimum_score",
            metric_unit: "points",
            group_type: "express_entry",
            latest: {
              title: "French category round",
              event_date: "2026-06-03",
              program: "Express Entry",
              stage: "French",
              minimum_score: "447",
              invitations: "2,300",
            },
            previous: {
              title: "French category round",
              event_date: "2026-05-20",
              program: "Express Entry",
              stage: "French",
              minimum_score: "451",
              invitations: "2,150",
            },
            score_delta: -4,
            invitation_delta: 150,
            points: [],
          },
          {
            label: "Base",
            count: 22,
            metric_name: "minimum_score",
            metric_unit: "points",
            group_type: "express_entry",
            latest: {
              title: "General draw",
              event_date: "2026-05-31",
              program: "Express Entry",
              stage: "Base",
              minimum_score: "521",
              invitations: "3,500",
            },
            previous: {
              title: "General draw",
              event_date: "2026-05-17",
              program: "Express Entry",
              stage: "Base",
              minimum_score: "519",
              invitations: "3,700",
            },
            score_delta: 2,
            invitation_delta: -200,
            points: [],
          },
        ],
      };
    case "/api/insights":
      return {
        generated_at: now,
        window_days: 30,
        compare_days: 30,
        payload: {
          window: {
            recent_days: 30,
            compare_days: 30,
            anchor_date: "2026-06-07",
            recent_start: "2026-05-08",
            previous_start: "2026-04-08",
          },
          sections: {
            bc_pnp: {
              label: "BC PNP",
              recent_count: 18,
              previous_count: 14,
              count_delta: 4,
              avg_score_recent: 104,
              avg_score_previous: 107,
              score_delta: -3,
              avg_invitations_recent: 68,
              avg_invitations_previous: 58,
              invitation_delta: 10,
              direction: "up",
              rising_categories: [
                { program: "BC PNP", key: "tech", label: "Tech", count_recent: 8, count_previous: 5, count_delta: 3, score_delta: -2, invitation_delta: 6, momentum: 9, latest_event_date: "2026-06-07", latest_score: "102", latest_invitations: "82" },
                { program: "BC PNP", key: "health", label: "Health", count_recent: 4, count_previous: 3, count_delta: 1, score_delta: -1, invitation_delta: 5, momentum: 6, latest_event_date: "2026-06-04", latest_score: "106", latest_invitations: "50" },
              ],
              falling_categories: [
                { program: "BC PNP", key: "base", label: "Base", count_recent: 2, count_previous: 4, count_delta: -2, score_delta: 3, invitation_delta: -8, momentum: -5, latest_event_date: "2026-05-30", latest_score: "110", latest_invitations: "44" },
              ],
            },
            express_entry: {
              label: "Express Entry",
              recent_count: 16,
              previous_count: 15,
              count_delta: 1,
              avg_score_recent: 481,
              avg_score_previous: 485,
              score_delta: -4,
              avg_invitations_recent: 2480,
              avg_invitations_previous: 2300,
              invitation_delta: 180,
              direction: "flat",
              rising_categories: [
                { program: "Express Entry", key: "french", label: "French", count_recent: 6, count_previous: 4, count_delta: 2, score_delta: -4, invitation_delta: 150, momentum: 8, latest_event_date: "2026-06-03", latest_score: "447", latest_invitations: "2,300" },
                { program: "Express Entry", key: "stem", label: "STEM", count_recent: 4, count_previous: 3, count_delta: 1, score_delta: -2, invitation_delta: 50, momentum: 5, latest_event_date: "2026-05-27", latest_score: "470", latest_invitations: "1,900" },
              ],
              falling_categories: [
                { program: "Express Entry", key: "base", label: "Base", count_recent: 3, count_previous: 5, count_delta: -2, score_delta: 2, invitation_delta: -200, momentum: -4, latest_event_date: "2026-05-31", latest_score: "521", latest_invitations: "3,500" },
              ],
            },
            processing_time: {
              bc_pnp: {
                label: "BC PNP",
                recent_avg_days: 61,
                previous_avg_days: 56,
                delta_days: 5,
                direction: "down",
              },
              ircc: {
                label: "IRCC",
                recent_avg_days: 84,
                previous_avg_days: 81,
                delta_days: 3,
                direction: "down",
              },
            },
            momentum: [
              { program: "BC PNP", key: "tech", label: "Tech", count_recent: 8, count_previous: 5, count_delta: 3, score_delta: -2, invitation_delta: 6, momentum: 9, latest_event_date: "2026-06-07", latest_score: "102", latest_invitations: "82" },
              { program: "Express Entry", key: "french", label: "French", count_recent: 6, count_previous: 4, count_delta: 2, score_delta: -4, invitation_delta: 150, momentum: 8, latest_event_date: "2026-06-03", latest_score: "447", latest_invitations: "2,300" },
              { program: "BC PNP", key: "health", label: "Health", count_recent: 4, count_previous: 3, count_delta: 1, score_delta: -1, invitation_delta: 5, momentum: 6, latest_event_date: "2026-06-04", latest_score: "106", latest_invitations: "50" },
              { program: "Express Entry", key: "stem", label: "STEM", count_recent: 4, count_previous: 3, count_delta: 1, score_delta: -2, invitation_delta: 50, momentum: 5, latest_event_date: "2026-05-27", latest_score: "470", latest_invitations: "1,900" },
            ],
          },
        },
        insights: {
          summary_ko: "BC PNP는 선별적이고, Express Entry는 카테고리 변화가 계속 중요합니다.",
          outlook_ko: "BC PNP 쪽은 Tech와 Health가 상대적으로 힘을 얻고 있고, Express Entry는 French와 STEM의 변화가 더 읽힙니다.",
          highlights: ["BC PNP Tech momentum is rising", "French category remains active", "Processing time is edging longer"],
          risks: ["Recent sample size is still limited", "Base category is softer", "Profile inputs are incomplete"],
          opportunities: ["Improve language score", "Confirm NOC", "Add employer support details"],
          watchlist: ["BC PNP Tech", "French category", "Processing time"],
        },
      };
    case "/api/express-entry":
      return {
        record_count: 24,
        latest_round: {
          title: "Express Entry category-based draw",
          event_date: "2026-06-03",
          program: "Express Entry",
          stage: "French",
          minimum_score: "447",
          invitations: "2,300",
          source_title: "IRCC rounds",
          publisher: "IRCC",
          source_url: "https://example.com",
          data_basis_at: now,
        },
        recent_rounds: [
          {
            title: "Express Entry category-based draw",
            event_date: "2026-06-03",
            program: "Express Entry",
            stage: "French",
            minimum_score: "447",
            invitations: "2,300",
            source_title: "IRCC rounds",
            publisher: "IRCC",
            source_url: "https://example.com",
            data_basis_at: now,
          },
          {
            title: "Express Entry general draw",
            event_date: "2026-05-31",
            program: "Express Entry",
            stage: "Base",
            minimum_score: "521",
            invitations: "3,500",
            source_title: "IRCC rounds",
            publisher: "IRCC",
            source_url: "https://example.com",
            data_basis_at: now,
          },
        ],
        category_summary: [
          { label: "Canadian Experience Class", count: 6, latest_round: { title: "CEC draw", event_date: "2026-05-28", program: "Express Entry", stage: "CEC", minimum_score: "482", invitations: "1,800" }, latest_score: "482", latest_invitations: "1,800", latest_event_date: "2026-05-28" },
          { label: "Federal Skilled Worker", count: 5, latest_round: { title: "FSW draw", event_date: "2026-05-31", program: "Express Entry", stage: "FSW", minimum_score: "521", invitations: "3,500" }, latest_score: "521", latest_invitations: "3,500", latest_event_date: "2026-05-31" },
          { label: "French", count: 7, latest_round: { title: "French draw", event_date: "2026-06-03", program: "Express Entry", stage: "French", minimum_score: "447", invitations: "2,300" }, latest_score: "447", latest_invitations: "2,300", latest_event_date: "2026-06-03" },
          { label: "STEM", count: 4, latest_round: { title: "STEM draw", event_date: "2026-05-27", program: "Express Entry", stage: "STEM", minimum_score: "470", invitations: "1,900" }, latest_score: "470", latest_invitations: "1,900", latest_event_date: "2026-05-27" },
        ],
        source_summary: [
          { source_id: "ircc", title: "IRCC rounds", publisher: "IRCC", count: 24, latest_event_date: "2026-06-03", latest_round: { title: "French draw", event_date: "2026-06-03", program: "Express Entry", stage: "French", minimum_score: "447", invitations: "2,300" } },
        ],
      };
    case "/api/program-overview":
      return {
        bc_pnp: {
          record_count: 48,
          latest_draw: {
            title: "BC PNP Tech draw",
            event_date: "2026-06-07",
            program: "BC PNP",
            stage: "Skills Immigration",
            minimum_score: "102",
            invitations: "82",
          },
          category_summary: [
            { label: "Health", count: 8, latest_round: { title: "Health draw", event_date: "2026-06-04", program: "BC PNP", stage: "Health", minimum_score: "106", invitations: "50" }, latest_score: "106", latest_invitations: "50", latest_event_date: "2026-06-04" },
            { label: "Childcare", count: 5, latest_round: { title: "Childcare draw", event_date: "2026-05-29", program: "BC PNP", stage: "Childcare", minimum_score: "108", invitations: "38" }, latest_score: "108", latest_invitations: "38", latest_event_date: "2026-05-29" },
            { label: "Construction", count: 6, latest_round: { title: "Construction draw", event_date: "2026-05-25", program: "BC PNP", stage: "Construction", minimum_score: "110", invitations: "46" }, latest_score: "110", latest_invitations: "46", latest_event_date: "2026-05-25" },
            { label: "Tech", count: 12, latest_round: { title: "Tech draw", event_date: "2026-06-07", program: "BC PNP", stage: "Tech", minimum_score: "102", invitations: "82" }, latest_score: "102", latest_invitations: "82", latest_event_date: "2026-06-07" },
            { label: "High Economic Impact", count: 10, latest_round: { title: "HEI draw", event_date: "2026-06-01", program: "BC PNP", stage: "High Economic Impact", minimum_score: "104", invitations: "64" }, latest_score: "104", latest_invitations: "64", latest_event_date: "2026-06-01" },
          ],
          source_summary: [
            { source_id: "welcomebc", title: "BC PNP Draws", publisher: "WelcomeBC", count: 48, latest_event_date: "2026-06-07", latest_round: { title: "Tech draw", event_date: "2026-06-07", program: "BC PNP", stage: "Tech", minimum_score: "102", invitations: "82" } },
          ],
        },
        express_entry: {
          record_count: 24,
          latest_draw: {
            title: "Express Entry category-based draw",
            event_date: "2026-06-03",
            program: "Express Entry",
            stage: "French",
            minimum_score: "447",
            invitations: "2,300",
          },
          category_summary: [
            { label: "Canadian Experience Class", count: 6, latest_round: { title: "CEC draw", event_date: "2026-05-28", program: "Express Entry", stage: "CEC", minimum_score: "482", invitations: "1,800" }, latest_score: "482", latest_invitations: "1,800", latest_event_date: "2026-05-28" },
            { label: "Federal Skilled Worker", count: 5, latest_round: { title: "FSW draw", event_date: "2026-05-31", program: "Express Entry", stage: "FSW", minimum_score: "521", invitations: "3,500" }, latest_score: "521", latest_invitations: "3,500", latest_event_date: "2026-05-31" },
            { label: "French", count: 7, latest_round: { title: "French draw", event_date: "2026-06-03", program: "Express Entry", stage: "French", minimum_score: "447", invitations: "2,300" }, latest_score: "447", latest_invitations: "2,300", latest_event_date: "2026-06-03" },
            { label: "STEM", count: 4, latest_round: { title: "STEM draw", event_date: "2026-05-27", program: "Express Entry", stage: "STEM", minimum_score: "470", invitations: "1,900" }, latest_score: "470", latest_invitations: "1,900", latest_event_date: "2026-05-27" },
            { label: "PNP", count: 2, latest_round: { title: "PNP draw", event_date: "2026-05-22", program: "Express Entry", stage: "PNP", minimum_score: "566", invitations: "1,000" }, latest_score: "566", latest_invitations: "1,000", latest_event_date: "2026-05-22" },
          ],
          source_summary: [
            { source_id: "ircc", title: "IRCC rounds", publisher: "IRCC", count: 24, latest_event_date: "2026-06-03", latest_round: { title: "French draw", event_date: "2026-06-03", program: "Express Entry", stage: "French", minimum_score: "447", invitations: "2,300" } },
          ],
        },
      };
    case "/api/policy-overview":
      return {
        processing_times: {
          record_count: 18,
          bc_pnp: {
            label: "BC PNP",
            record_count: 9,
            latest_records: [
              { title: "BC PNP processing time", event_date: "2026-06-07", program: "BC PNP", stage: "Skills Immigration", processing_time: "8-10 weeks" },
              { title: "BC PNP processing time", event_date: "2026-05-30", program: "BC PNP", stage: "Skills Immigration", processing_time: "7-9 weeks" },
            ],
            source_summary: [{ source_id: "processing-time", title: "Processing Time", publisher: "IRCC", count: 9, latest_event_date: "2026-06-07" }],
          },
          ircc: {
            label: "IRCC",
            record_count: 9,
            latest_records: [
              { title: "IRCC processing time", event_date: "2026-06-07", program: "Express Entry", stage: "CEC", processing_time: "84 days" },
              { title: "IRCC processing time", event_date: "2026-05-30", program: "Express Entry", stage: "CEC", processing_time: "81 days" },
            ],
            source_summary: [{ source_id: "processing-time", title: "Processing Time", publisher: "IRCC", count: 9, latest_event_date: "2026-06-07" }],
          },
        },
        policy_signals: {
          change_count: 12,
          bc_pnp: {
            label: "BC PNP",
            change_count: 7,
            latest_changes: [
              { title: "BC PNP Tech category", change_type: "policy", impact_level: "high", needs_review: 1, summary_ko: "Tech 관련 흐름이 강화되었습니다.", detected_at: now },
            ],
            source_summary: [{ source_id: "policy-updates", title: "Policy Updates", publisher: "BC Gov", count: 7 }],
          },
          ircc: {
            label: "IRCC",
            change_count: 5,
            latest_changes: [
              { title: "French category", change_type: "trend", impact_level: "medium", needs_review: 0, summary_ko: "프랑스어 관련 신호가 유지됩니다.", detected_at: now },
            ],
            source_summary: [{ source_id: "ircc", title: "IRCC rounds", publisher: "IRCC", count: 5 }],
          },
        },
      };
    case "/api/status-overview":
      return {
        bc_pnp: {
          label: "BC PNP",
          source_count: 2,
          ok_count: 2,
          error_count: 0,
          unknown_count: 0,
          source_summary: [
            { source_id: "welcomebc", title: "BC PNP Draws", publisher: "WelcomeBC", status: "ok", checked_at: now, changed: true, new_records: 1 },
            { source_id: "policy-updates", title: "Policy Updates", publisher: "BC Gov", status: "ok", checked_at: now, changed: false, new_records: 0 },
          ],
          latest_changes: [
            { title: "BC PNP Tech category", change_type: "policy", impact_level: "high", needs_review: 1, summary_ko: "Tech 관련 흐름이 강화되었습니다.", detected_at: now },
          ],
          latest_signal: { title: "BC PNP Tech category", change_type: "policy", impact_level: "high", needs_review: 1, summary_ko: "Tech 관련 흐름이 강화되었습니다.", detected_at: now },
        },
        ircc: {
          label: "IRCC",
          source_count: 2,
          ok_count: 2,
          error_count: 0,
          unknown_count: 0,
          source_summary: [
            { source_id: "ircc", title: "IRCC rounds", publisher: "IRCC", status: "ok", checked_at: now, changed: true, new_records: 1 },
            { source_id: "processing-time", title: "Processing Time", publisher: "IRCC", status: "ok", checked_at: now, changed: false, new_records: 0 },
          ],
          latest_changes: [
            { title: "French category", change_type: "trend", impact_level: "medium", needs_review: 0, summary_ko: "프랑스어 관련 신호가 유지됩니다.", detected_at: now },
          ],
          latest_signal: { title: "French category", change_type: "trend", impact_level: "medium", needs_review: 0, summary_ko: "프랑스어 관련 신호가 유지됩니다.", detected_at: now },
        },
      };
    case "/api/profile":
      return baseProfile;
    default:
      return null;
  }
}
