// Legal pages content. Written from the app's real behaviour.
// IMPORTANT: this is a draft. It must be reviewed by a qualified lawyer before publication.
// Placeholders in [brackets] must be replaced with the operator's real details.

export const OPERATOR = {
  name: '[Operator name / company]',
  address: '[Postal address]',
  email: '[contact@example.com]',
  dpo: '[privacy@example.com]',
  updated: '[Date of last update]',
}

export const PROVIDERS = [
  { name: 'Supabase', role: 'Hosting of the database, authentication, file storage (avatars)', region: 'European Union (eu-west-1, Ireland)' },
  { name: 'Resend', role: 'Sending of invitation e-mails', region: '[Confirm region before publication]' },
  { name: 'Vercel', role: 'Hosting of the web application', region: '[Confirm region before publication]' },
]

export const PAGES = {
  terms: {
    title: 'Terms of Use',
    sections: [
      { h: '1. Purpose', p: 'Calendar App is a web calendar that lets you create, edit and delete events, organise them into calendars, and share calendars with other people through invitations.' },
      { h: '2. Accounts', p: 'You create an account with an e-mail address and a password. You are responsible for keeping your credentials confidential and for all activity under your account. You must provide accurate information and be at least 16 years old, or the age of digital consent in your country.' },
      { h: '3. Your content', p: 'You own the events, titles, descriptions, locations and photos you add. You grant the operator only the rights needed to store and display them to you and to the people you share with.' },
      { h: '4. Sharing and roles', p: 'When you invite someone to a calendar, they receive an e-mail and can accept or decline. Access is granted only after acceptance. Roles (Administrator, Contributor, Reader) define what each member can do. Do not share calendars with people who have not agreed to receive them.' },
      { h: '5. Acceptable use', p: 'You must not use the service to store unlawful content, to harass others, to send unsolicited messages through invitations, to attempt unauthorised access to other accounts or data, or to disrupt the service.' },
      { h: '6. Availability', p: 'The service is provided "as is". We aim for continuous availability but do not guarantee it. Features may change over time.' },
      { h: '7. Termination', p: 'You may delete your account at any time. We may suspend accounts that breach these terms.' },
      { h: '8. Liability', p: 'To the extent permitted by law, the operator is not liable for indirect losses, including missed events or losses resulting from a shared calendar being changed by another member.' },
      { h: '9. Governing law', p: 'These terms are governed by [applicable law]. Mandatory consumer rights in your country of residence are not affected.' },
      { h: '10. Contact', p: 'Questions: [contact e-mail].' },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    sections: [
      { h: '1. Who we are', p: 'Data controller: [Operator name], [address], [contact e-mail]. Data protection contact: [DPO e-mail].' },
      { h: '2. Data we collect', p: 'Account data: e-mail address and password (stored as a hash by our authentication provider). Profile data: display name and optional profile photo. Calendar data: calendars, events (title, description, location, start and end times, reminder), and the history of changes made to events. Sharing data: members, roles and invitations. Technical data: language preference stored in your browser.' },
      { h: '3. Why we process it', p: 'To provide the service you requested (creating and sharing calendars), to send invitation e-mails you trigger, to keep an activity history so changes can be reviewed and restored, and to keep the service secure. Legal basis under the GDPR: performance of a contract (Art. 6(1)(b)); legitimate interests in security (Art. 6(1)(f)); consent where you upload a photo (Art. 6(1)(a)).' },
      { h: '4. Who can see your data', p: 'Your own data is private by default. Calendar content is visible to the members of that calendar according to their role. Other members can see your display name and photo on a calendar you share. The history of a shared event is visible to the members of that calendar.' },
      { h: '5. Service providers', p: 'We use the following processors: ' + PROVIDERS.map((p) => `${p.name} (${p.role}; ${p.region})`).join('; ') + '. Data transfers outside the EU/EEA, if any, use safeguards such as Standard Contractual Clauses.' },
      { h: '6. Retention', p: 'We keep your data while your account is active. When you delete your account, your personal data is deleted, except where we must keep it by law. Event history is removed together with the events it describes. [Specify retention periods for backups before publication.]' },
      { h: '7. Your rights', p: 'Under the GDPR and similar laws you can access, correct, delete, restrict or port your data, object to processing, and withdraw consent at any time. You can edit your profile and events in the app, and contact us to exercise other rights. You may lodge a complaint with your national data protection authority.' },
      { h: '8. Security', p: 'Data is encrypted in transit (HTTPS). Access to data is restricted by row-level security rules so that each user only reaches the calendars they own or were invited to. No system is perfectly secure; we will notify you of any breach as required by law.' },
      { h: '9. Children', p: 'The service is not directed at children under 16 (or the national digital consent age).' },
      { h: '10. International transfers', p: 'Where data leaves the EU/EEA, we rely on adequacy decisions or Standard Contractual Clauses. [Confirm each processor location before publication.]' },
      { h: '11. Changes', p: 'We will update this policy and the date below when practices change. Last updated: ' + '[Date]' + '.' },
    ],
  },
  cookies: {
    title: 'Cookie Policy',
    sections: [
      { h: '1. What we use', p: 'Calendar App does not use advertising, tracking or analytics cookies. It uses browser storage (localStorage) for two purposes only.' },
      { h: '2. Strictly necessary storage', p: 'Session: keeps you signed in between visits (set by our authentication provider). Language: remembers your chosen interface language. Neither requires consent under the ePrivacy rules because they are strictly necessary to provide the service you asked for.' },
      { h: '3. Third-party cookies', p: 'The application does not load third-party advertising or analytics scripts. Our hosting and authentication providers may set technical cookies needed for security and delivery.' },
      { h: '4. Managing storage', p: 'You can clear this storage at any time through your browser settings. Clearing the session will sign you out; clearing the language choice will reset it to English.' },
      { h: '5. Changes', p: 'If we add non-essential storage in the future, we will ask for your consent first. Last updated: [Date].' },
    ],
  },
}
