# Application mineur et calendrier d'équipe dédié : conception

Statut : **en production depuis le 17 novembre 2026, testé de bout en bout (voir section 12) ; relecture juridique en attente.** Elle complète `docs/FAMILY_TEAM.md` et **remplace** sa décision « un mineur n'a pas de compte
en dessous de l'âge du consentement » : le mineur aura désormais un accès créé et géré par un adulte responsable.
Elle doit être relue par un juriste avant toute mise en service.

---

## 1. Décisions du propriétaire

| Sujet | Décision |
|---|---|
| Calendrier | Un calendrier **dédié** à chaque équipe (famille, équipe sportive, classe), accessible **seulement** à ses membres |
| Identifiant du mineur | Généré automatiquement quand l'adulte signe la déclaration |
| Connexion du mineur | **E-mail du propriétaire de l'équipe + identifiant**. Le propriétaire transmet l'identifiant au mineur |
| Parents | Soit la même connexion (e-mail du propriétaire + identifiant), soit un **compte adulte normal** invité par **@pseudo** |
| Droits du mineur | **Chat d'équipe seulement.** Il lit le calendrier de l'équipe, il ne modifie aucun événement |
| IA dans le chat | Sous la responsabilité de l'adulte propriétaire |
| Seuil d'âge | **13 ans.** En dessous : consentement par e-mail du responsable du mineur. À partir de 13 ans : la signature déjà implantée suffit |
| Nom de l'équipe | Libre. Suggestion tirée du **nom vérifié**, jamais de l'e-mail. Le parent voit l'adresse du propriétaire **masquée** (`s***@gmail.com`) sur la page de consentement |
| À 16 ans | Le mineur peut demander un compte adulte, avec l'accord de l'adulte responsable ; l'accès par identifiant s'arrête |
| Plusieurs équipes | Un identifiant par équipe |

### Deux lectures à confirmer
1. **Seuil de 13 ans** : j'ai compris que la règle ne s'applique pas à « un âge minimal » mais à un **palier** : en dessous de 13 ans, le consentement par e-mail est exigé en plus ; à partir de 13 ans, la signature seule suffit.
2. **IA** : le texte précédent parlait d'un « accord du responsable juridique ». J'ai lu cette fois que le responsable est **l'adulte propriétaire**. L'exigence d'une approbation juridique enregistrée par un opérateur est donc **retirée** ; l'IA reste soumise à la déclaration signée qui la couvre.

---

## 2. Calendrier d'équipe dédié

- Un écran **« Nouveau groupe »** : nom et type (famille, équipe sportive, classe). Réservé aux créateurs vérifiés (Stripe Identity).
- Le calendrier est **nouveau** : il ne reprend pas le calendrier personnel du propriétaire. Aujourd'hui, l'application change le type du calendrier existant, ce qui mélangerait les événements.
- Accès : le propriétaire, les adultes invités (par @pseudo), les parents qui ont un compte adulte, et les comptes mineurs de cette équipe. Personne d'autre.

---

## 3. Compte et identifiant du mineur

### 3.1 Création
- Quand un adulte signe la déclaration d'un profil mineur (section 14 de `FAMILY_TEAM.md`), Collyo crée :
  - un **identifiant** aléatoire et long (**12 caractères**, non séquentiel), unique, affiché une seule fois à l'adulte ;
  - un compte technique réservé au mineur, sans adresse e-mail réelle ni mot de passe.
- La déclaration couvre explicitement « créer un accès pour ce mineur » (fonction `access`).
- L'adulte peut **régénérer** l'identifiant ou **couper** l'accès à tout moment. L'ancien identifiant cesse alors de fonctionner.

### 3.2 Connexion du mineur
Écran **« Accès mineur »** : e-mail du propriétaire de l'équipe, et identifiant.
1. Le serveur retrouve le profil par l'identifiant et vérifie que l'e-mail est bien celui du propriétaire du calendrier. Les deux messages d'erreur sont identiques, pour ne rien révéler.
2. Limitation des essais : au bout de 5 échecs pour un identifiant ou une adresse IP, blocage de 15 minutes.
3. Si tout correspond, le serveur ouvre une session pour le compte du mineur (même mécanisme que la connexion par clé d'accès).
4. La session est courte. Il n'y a pas de réinitialisation par e-mail : seul l'adulte peut régénérer l'identifiant.

### 3.3 Sécurité de l'identifiant
L'e-mail du propriétaire n'est pas un secret : l'**identifiant est le seul secret**. Il est donc long, aléatoire, jamais déduit d'une donnée personnelle, et jamais conservé en clair (seule son empreinte l'est).

---

## 4. Moins de 13 ans : consentement par e-mail

1. Le propriétaire ajoute le mineur. Le système calcule l'âge à partir de l'**année de naissance**. Comme seule l'année est connue, on exige le consentement dès que l'âge **possible** est inférieur à 13 ans.
2. Le formulaire demande l'**adresse e-mail du responsable du mineur**. Le profil passe à « consentement demandé ».
3. Un e-mail part au responsable avec : le nom du propriétaire, le nom de l'équipe, les données collectées sur l'enfant, les fonctions (chat, calendrier), et un **bouton « J'approuve »**.
4. Le bouton ouvre une page sans connexion, qui affiche le texte du consentement et un second bouton de confirmation. Le lien est à usage unique, valable 7 jours.
5. Une fois approuvé, le propriétaire peut signer la déclaration, puis l'identifiant est créé. Sans approbation, la signature est refusée (« consentement requis »).
6. L'approbation est enregistrée : date, adresse du responsable, version du texte, jamais l'adresse IP.

**À partir de 13 ans** : la signature déjà implantée suffit, sans e-mail.

---

## 5. Les parents

- **Option A, même connexion** : le parent utilise l'e-mail du propriétaire et l'identifiant du mineur. *Il apparaît alors comme le mineur dans le chat.* Je la déconseille pour la lecture du chat.
- **Option B, compte adulte (recommandé)** : le parent crée un compte normal et le propriétaire l'invite par @pseudo (invitation existante). Il voit le calendrier et le chat sous son propre nom.
- **Adulte responsable ajouté par e-mail** (panneau Famille) : s'il a un compte, il est lié au profil, ajouté au calendrier comme contributeur et **prévenu par e-mail** ; sinon une invitation est enregistrée, un e-mail lui demande de créer un compte, et il est lié **automatiquement quand son adresse est confirmée**. Ce n'est pas le consentement des moins de 13 ans, qui est un autre e-mail (section 4).

---

## 6. Application mineur

Même site, interface **réduite**, affichée quand la session est celle d'un compte mineur.

| Autorisé | Interdit |
|---|---|
| Voir le calendrier de l'équipe | Créer, modifier, supprimer un événement |
| Lire et écrire dans le chat de l'équipe | Assistant IA, connecteur, clés d'accès |
| Voir les notifications de mention | Bien-être, invitations, réglages d'équipe, profil étendu |
| Se déconnecter | Voir d'autres calendriers que celui de l'équipe |

Ces limites sont appliquées **côté base de données** (règles de sécurité) et **côté fonctions** : une interface réduite seule ne suffit pas.

### Chat
- Un mineur ne parle qu'à son équipe.
- Il peut écrire, et **solliciter l'IA** quand le propriétaire l'a activée et que la déclaration signée la couvre (section 7). Sinon il voit un message simple : « L'IA n'est pas encore disponible pour ce groupe. Demandez à l'adulte responsable. »
- Les messages peuvent être supprimés par le propriétaire.

---

## 7. IA et mineurs (mis à jour)

- L'IA du chat reste **désactivée par défaut**. Le propriétaire l'active dans le chat, comme aujourd'hui.
- Elle ne s'applique à un calendrier avec mineur que si **chaque mineur actif est couvert par une déclaration signée incluant l'IA**.
- L'approbation juridique enregistrée par un opérateur (`ai_legal_approvals`) n'est plus exigée. La table peut rester, sans effet sur la règle.
- Rappel : si l'IA est active, les messages des mineurs sont envoyés au fournisseur d'IA. Cela peut changer la méthode de consentement exigée pour les moins de 13 ans (section 9).
- **Un mineur peut solliciter l'IA** si elle est activée et couverte par la déclaration (décision du propriétaire du 17 novembre 2026). Garde-fous côté serveur : **20 demandes par jour** au plus, **aucun outil d'écriture** sur le calendrier, et un cadre de réponse adapté aux enfants dès que le groupe compte un mineur (les réponses sont lues par tous).

---

## 8. Modèle de données (esquisse)

- `calendars` : création d'un calendrier d'équipe par une fonction réservée aux créateurs vérifiés.
- `managed_profiles` : `access_id_hash`, `auth_user_id`, `access_disabled`, `guardian_email`, `consent_status` (`not_required | pending | approved | expired`), `consent_requested_at`, `consent_approved_at`.
- `profiles.account_type` : `adult` ou `minor`.
- `calendar_members.role` : nouveau rôle `minor` (lecture du calendrier, lecture et écriture du chat, rien d'autre).
- `minor_consents` : jeton (empreinte), expiration, utilisation, version du texte.
- `minor_login_attempts` : compteurs d'échecs pour la limitation.
- Fonctions serveur : `minor-access` (création, régénération, coupure, connexion), `send-consent` (e-mail du responsable), page de consentement.

---

## 9. Points légaux (à relire par un juriste)

- **États-Unis (COPPA)** : le consentement par e-mail seul n'est accepté que dans des cas limités (méthode « e-mail plus », sans divulgation des données de l'enfant à des tiers). **Avec l'IA active, les messages de l'enfant vont à un tiers** : une méthode plus forte peut être exigée (par exemple une vérification de l'identité du parent).
- **Europe (RGPD, art. 8)** : consentement du titulaire de l'autorité parentale en dessous de l'âge national (13 à 16 ans). La signature de l'adulte responsable le couvre, sous réserve de la relecture.
- **Le propriétaire peut saisir n'importe quelle adresse** comme « responsable » : l'e-mail prouve l'accès à une boîte, pas l'autorité parentale. Risque accepté, à valider.
- Un enseignant ou un entraîneur ajoute des élèves dont il n'a pas l'autorité parentale : le consentement du parent doit être celui du parent, pas celui du propriétaire.
- **Mentions légales, confidentialité et page d'accueil** à mettre à jour (section « Enfants » : l'accès mineur existe désormais).

### Risques acceptés par le propriétaire
- L'**e-mail du propriétaire est connu** des mineurs, et d'un enseignant dans une classe.
- L'**identifiant est le seul secret** : sa longueur, la limitation des essais et la régénération le compensent.
- Un parent qui utilise la connexion du mineur apparaît sous l'identité de l'enfant.

---

## 10. Ordre de réalisation proposé

1. Création du calendrier d'équipe dédié.
2. Retrait de l'exigence d'approbation juridique pour l'IA (règle `minor_ai_allowed`).
3. Rôle `minor`, règles de sécurité et tests (adulte, tuteur, mineur).
4. Consentement par e-mail pour les moins de 13 ans.
5. Création, régénération et coupure de l'identifiant ; connexion « accès mineur ».
6. Application mineur réduite (calendrier en lecture, chat).
7. Mise à jour des mentions légales, de la page d'accueil et des documents.

## 11. Décisions finales

1. Les deux lectures de la section 1 sont confirmées.
2. **À 16 ans**, le mineur peut passer à un compte adulte (voir section 12, non livré).
3. **Un identifiant par équipe** : un même mineur dans deux équipes a deux identifiants.
4. **Nom de l'équipe** : option A, nom libre avec suggestion tirée du nom vérifié, adresse masquée sur la page de consentement.

---

## 12. État de l'implantation

**En production, testé de bout en bout**
- Migration `migrations_020_minor_access.sql` : type de compte, rôle `minor`, règles de sécurité (le mineur ne lit pas les profils des autres, n'édite pas son profil, n'utilise ni IA, ni bien-être, ni clés d'accès), colonnes d'accès et de consentement, tables `minor_consents` et `minor_login_attempts`, règle de l'IA sans approbation d'opérateur, consentement exigé sous 13 ans dans `sign_managed_profile`.
- Fonctions `minor-access` (création, régénération, coupure de l'identifiant ; connexion) et `minor-consent` (e-mail du responsable, page d'approbation). Secret `MINOR_ID_SECRET`.
- Les fonctions `assistant`, `mcp`, `webauthn` et `identity` refusent un compte mineur.
- Écrans : « Nouveau groupe », panneau Famille (consentement, case d'accès, identifiant affiché une fois, régénérer, couper), page de consentement `#/consent`, accès mineur `#/minor`, application réduite (calendrier en lecture seule et chat).
- Tests : 14 cas de base de données (transaction annulée), fonctions utilitaires, 22 vérifications dans un navigateur, et **39 vérifications de bout en bout en production** avec des comptes temporaires supprimés ensuite. Ce test a trouvé une faille (un mineur pouvait créer un calendrier), corrigée par la migration 021.

**Non livré**
- Passage d'un mineur à un compte adulte à 16 ans.
- ~~Suppression du compte technique d'un mineur retiré~~ : faite par la fonction `team-admin` (retrait d'un profil et suppression d'un calendrier), réservée au propriétaire.
- Relecture juridique (section 9).
