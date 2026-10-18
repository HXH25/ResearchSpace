import type { Language, Purpose, ReadingLevel } from '../types';

export const languageLabels: Record<Language,string> = {'zh-CN':'中文',en:'English',de:'Deutsch',ja:'日本語',fr:'Français'};
export const purposeLabels: Record<Purpose,string> = {research_enquiry:'科研参与咨询',application:'正式项目申请',eligibility_question:'申请资格咨询',materials:'准备材料咨询',public_event:'公开活动参与咨询',follow_up:'跟进此前联系'};
export const opportunityStatusLabels={open_confirmed:'已确认开放',upcoming:'尚未开始',closed:'已关闭',unknown:'尚未核实'};
export const eligibilityLabels={tsinghua_only:'清华学生',home_institution_only:'主办学校学生',international_eligible:'国际学生可申请',open_to_all:'公开申请',unknown:'尚未核实'};
interface Pack {
  intent: Record<Purpose,string>; salutation: (name:string)=>string; closing:string;
  intro:(name:string,institution:string,year:string,department:string)=>string;
  interest:(text:string)=>string; experience:(text:string)=>string; research:(text:string)=>string;
  reading:Record<ReadingLevel,(title:string)=>string>;
  hours:(v:string)=>string; start:(v:string)=>string; materials:(v:string)=>string;
  project:(title:string)=>string; followup:(date:string)=>string;
  request:Record<Purpose,string>; thanks:string;
}
export const packs:Record<Language,Pack> = {
  'zh-CN': {
    intent:{research_enquiry:'本科科研参与咨询',application:'项目申请',eligibility_question:'项目申请资格咨询',materials:'科研准备材料咨询',public_event:'公开学术活动参与咨询',follow_up:'科研联系跟进'},
    salutation:n=>`${n}您好：`,closing:'祝好！',
    intro:(n,i,y,d)=>`我是${n}${i?`，来自${i}`:''}${d?`（${d}）`:''}${y?`，目前是${y}学生`:''}。`,
    interest:t=>`我目前感兴趣的方向是${t}，希望通过实际参与进一步学习。`,experience:t=>`我的相关经历是：${t}`,
    research:t=>`从您公开的研究介绍中，我了解到：“${t}” 我希望进一步了解这一方向的具体研究问题。`,
    reading:{introduction:t=>`我看过与《${t}》相关的介绍，希望进一步了解。`,abstract:t=>`我阅读了《${t}》的摘要，希望进一步学习其中的研究问题。`,full:t=>`我通读了《${t}》，希望有机会进一步交流。`,reproduced:t=>`我曾对《${t}》进行复现，希望进一步交流相关问题。`},
    hours:v=>`我计划每周投入约${v}小时。`,start:v=>`我希望从${v}开始参与。`,materials:v=>`如有需要，我可以提供以下材料：${v}。`,
    project:t=>`我想就“${t}”项目与您联系。`,followup:d=>`我曾于${d}就科研参与事宜与您联系，这次想简要跟进。`,
    request:{research_enquiry:'请问您是否有适合本科生参与的科研机会？如有，也希望了解我可以提前完成的准备。',application:'我希望申请参与该项目，并按照官方要求提交所需材料。请问后续应如何安排？',eligibility_question:'请问我目前的背景是否符合该项目的申请资格？如有尚需满足的条件，烦请指明。',materials:'请问为了参与相关研究，我应优先准备哪些课程、技能或申请材料？',public_event:'请问是否有对本科生公开的学术报告或交流活动，以及相应的报名方式？',follow_up:'若您方便，希望了解此前咨询是否有进一步的信息。如暂时没有合适机会，我也理解。'},thanks:'感谢您抽时间阅读，期待您的建议。',
  },
  en:{
    intent:{research_enquiry:'Undergraduate research inquiry',application:'Project application',eligibility_question:'Application eligibility inquiry',materials:'Research preparation inquiry',public_event:'Public academic event inquiry',follow_up:'Follow-up on research inquiry'},
    salutation:n=>`Dear ${n},`,closing:'Best regards,',
    intro:(n,i,y,d)=>`My name is ${n}.${y?` I am a ${y}${i?` at ${i}`:''}${d?` (${d})`:''}.`:i?` I study at ${i}${d?` (${d})`:''}.`:d?` My department is ${d}.`:''}`,
    interest:t=>`My current interests include ${t}, and I would like to learn more through research.`,experience:t=>`A relevant experience from my background is: ${t}`,
    research:t=>`Your public research description mentions: “${t}”. I would appreciate the opportunity to learn more about the questions being explored.`,
    reading:{introduction:t=>`I have looked at an introduction to “${t}” and would like to learn more.`,abstract:t=>`I have read the abstract of “${t}” and would like to study the research questions further.`,full:t=>`I have read the full paper “${t}” and would welcome the opportunity to discuss it.`,reproduced:t=>`I have worked on reproducing “${t}” and would welcome further discussion.`},
    hours:v=>`I expect to be able to commit about ${v} hours per week.`,start:v=>`I hope to start ${v==='the summer break'?'during ':''}${v}.`,materials:v=>`If helpful, I can provide the following materials: ${v}.`,
    project:t=>`I am writing regarding the project “${t}”.`,followup:d=>`I contacted you on ${d} about research participation and would like to follow up briefly.`,
    request:{research_enquiry:'May I ask whether there are research opportunities suitable for an undergraduate with my background, and how I could prepare?',application:'I would like to apply for this project and provide the materials required by the official application process. Could you advise me on the next steps?',eligibility_question:'Could you clarify whether my current background meets the eligibility requirements and which conditions I would still need to satisfy?',materials:'Which courses, skills or application materials would you recommend preparing before participating in this research?',public_event:'Are there public talks or academic discussions that undergraduates may attend, and is registration required?',follow_up:'If you have any updates on my earlier inquiry, I would be grateful to hear them. I understand if no suitable opportunity is currently available.'},thanks:'Thank you for your time and consideration.',
  },
  de:{
    intent:{research_enquiry:'Anfrage zur Forschungsmitarbeit',application:'Bewerbung für ein Forschungsprojekt',eligibility_question:'Frage zur Bewerbungsberechtigung',materials:'Vorbereitung auf Forschungsmitarbeit',public_event:'Öffentliche wissenschaftliche Veranstaltungen',follow_up:'Nachfrage zu meiner Forschungsanfrage'},
    salutation:n=>`Guten Tag ${n},`,closing:'Mit freundlichen Grüßen',intro:(n,i,y,d)=>`mein Name ist ${n}.${i?` Ich studiere an der Einrichtung ${i}.`:''}${d?` Mein Fachbereich: ${d}.`:''}${y?` Mein Studienstand (Originalangabe): ${y}.`:''}`,
    interest:t=>`Meine Forschungsinteressen umfassen: ${t}.`,experience:t=>`Eine relevante Erfahrung ist: ${t}`,research:t=>`In Ihrer öffentlichen Forschungsbeschreibung steht: „${t}“. Darüber würde ich gerne mehr erfahren.`,
    reading:{introduction:t=>`Ich habe eine Einführung zu „${t}“ angesehen.`,abstract:t=>`Ich habe die Zusammenfassung von „${t}“ gelesen.`,full:t=>`Ich habe die vollständige Arbeit „${t}“ gelesen.`,reproduced:t=>`Ich habe an der Reproduktion der Arbeit „${t}“ gearbeitet.`},
    hours:v=>`Ich könnte etwa ${v} Stunden pro Woche aufwenden.`,start:v=>`Mein gewünschter Beginn (Originalangabe): ${v}.`,materials:v=>`Bei Bedarf kann ich folgende Unterlagen bereitstellen: ${v}.`,project:t=>`Meine Anfrage betrifft das Projekt „${t}“.`,followup:d=>`Ich hatte Ihnen am ${d} zur Forschungsmitarbeit geschrieben.`,
    request:{research_enquiry:'Gibt es Möglichkeiten zur Forschungsmitarbeit, die zu meinem derzeitigen Studienstand passen?',application:'Ich möchte mich für dieses Projekt bewerben und die offiziell geforderten Unterlagen einreichen. Wie wären die nächsten Schritte?',eligibility_question:'Erfüllt mein derzeitiger Hintergrund die Voraussetzungen für eine Bewerbung?',materials:'Welche Kenntnisse und Unterlagen sollte ich vorbereiten?',public_event:'Gibt es öffentliche Vorträge oder Diskussionen, an denen Studierende teilnehmen dürfen?',follow_up:'Gibt es inzwischen Neuigkeiten zu meiner Anfrage? Ich verstehe, falls derzeit keine passende Möglichkeit besteht.'},thanks:'Vielen Dank für Ihre Zeit.',
  },
  ja:{
    intent:{research_enquiry:'学部生の研究参加について',application:'研究プロジェクトへの応募',eligibility_question:'応募資格について',materials:'研究参加の準備について',public_event:'公開学術イベントについて',follow_up:'研究参加に関するお問い合わせの確認'},
    salutation:n=>`${n}様`,closing:'どうぞよろしくお願いいたします。',intro:(n,i,y,d)=>`${n}と申します。${i?`${i}に在籍しています。`:''}${d?`所属学科は${d}です。`:''}${y?`在学段階（原文）は${y}です。`:''}`,
    interest:t=>`現在、${t}に関心を持っており、研究を通じて学びたいと考えています。`,experience:t=>`関連する経験として、${t}`,research:t=>`公開されている研究紹介に「${t}」との記載があり、さらに詳しく学びたいと考えています。`,
    reading:{introduction:t=>`「${t}」の紹介を拝見しました。`,abstract:t=>`「${t}」の要旨を読みました。`,full:t=>`「${t}」の論文全文を読みました。`,reproduced:t=>`「${t}」の再現に取り組みました。`},
    hours:v=>`週に約${v}時間を充てる予定です。`,start:v=>`参加希望時期（原文）は${v}です。`,materials:v=>`必要に応じて、${v}を提供できます。`,project:t=>`「${t}」についてお問い合わせいたします。`,followup:d=>`${d}に研究参加についてご連絡しましたので、改めて確認させていただきます。`,
    request:{research_enquiry:'現在の私の背景に適した、学部生が参加できる研究の機会はございますでしょうか。',application:'公式の手順に従い、必要書類を提出して本プロジェクトに応募したいと考えています。今後の手順をご教示いただけますでしょうか。',eligibility_question:'現在の私の背景が応募資格を満たしているか、ご教示いただけますでしょうか。',materials:'事前に身につけるべき知識や準備する資料について、ご教示いただけますと幸いです。',public_event:'学部生も参加できる公開講演や交流会、および参加方法はございますでしょうか。',follow_up:'先日のお問い合わせについて、何か進展がございましたらお知らせいただけますと幸いです。現在機会がない場合も承知いたします。'},thanks:'お忙しいところお読みいただき、ありがとうございます。',
  },
  fr:{
    intent:{research_enquiry:'Demande de participation à la recherche',application:'Candidature à un projet de recherche',eligibility_question:'Question sur les conditions de candidature',materials:'Préparation à la recherche',public_event:'Événements scientifiques publics',follow_up:'Suivi de ma demande de recherche'},
    salutation:n=>`Bonjour ${n},`,closing:'Cordialement,',intro:(n,i,y,d)=>`Je m'appelle ${n}.${i?` Mon établissement est ${i}.`:''}${d?` Mon département est ${d}.`:''}${y?` Mon niveau d'études (indication d'origine) est : ${y}.`:''}`,
    interest:t=>`Mes centres d'intérêt en recherche comprennent : ${t}.`,experience:t=>`Une expérience pertinente de mon parcours est : ${t}`,research:t=>`Votre présentation publique de recherche mentionne : « ${t} ». Je souhaiterais en apprendre davantage.`,
    reading:{introduction:t=>`J'ai consulté une présentation de « ${t} ».`,abstract:t=>`J'ai lu le résumé de « ${t} ».`,full:t=>`J'ai lu l'article complet « ${t} ».`,reproduced:t=>`J'ai travaillé à la reproduction de « ${t} ».`},
    hours:v=>`Je pourrais consacrer environ ${v} heures par semaine à ce travail.`,start:v=>`Début souhaité (indication d'origine) : ${v}.`,materials:v=>`Si nécessaire, je peux fournir les documents suivants : ${v}.`,project:t=>`Ma demande concerne le projet « ${t} ».`,followup:d=>`Je vous avais écrit le ${d} au sujet d'une participation à la recherche.`,
    request:{research_enquiry:'Existe-t-il des possibilités de participation à la recherche adaptées à mon parcours actuel ?',application:'Je souhaite présenter ma candidature à ce projet selon la procédure officielle. Pourriez-vous m’indiquer les prochaines étapes ?',eligibility_question:'Mon parcours actuel satisfait-il aux conditions de candidature ?',materials:'Quelles connaissances et quels documents devrais-je préparer ?',public_event:'Existe-t-il des conférences ou discussions publiques accessibles aux étudiants, et comment y participer ?',follow_up:'Auriez-vous des nouvelles concernant ma demande précédente ? Je comprends si aucune possibilité adaptée n’est actuellement disponible.'},thanks:'Je vous remercie pour votre temps.',
  },
};
