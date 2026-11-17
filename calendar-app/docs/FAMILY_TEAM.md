# Modes famille, équipe sportive et classe scolaire : conception

Statut : **conception, rien n'est implanté.** Ce document fixe les choix faits avant tout code.
Il doit être relu par le responsable juridique avant toute mise en service, en particulier pour les mineurs.
Marchés visés : **Europe et Amérique**.

---

## 1. Décisions validées

| Sujet | Décision |
|---|---|
| Modes livrés | Famille, équipe sportive, classe scolaire (mode équipe de travail existant inchangé) |
| Mineur | Peut **voir** ses propres données |
| IA et messages des mineurs | Désactivée par défaut. Activable **seulement** après accord du responsable juridique, enregistré |
| Sexe du mineur | Collecté, **facultatif**, avec la raison affichée |
| Marchés | Europe et Amérique |
| Activation des modes | Le **créateur** du calendrier est vérifié par Stripe Identity. Les autres membres ne le sont pas |
| Accord des majeurs | Déclaration **signée** par le majeur responsable (nom et prénom). Sans signature, l'ajout du mineur reste **en revue** (section 14) |
| Questions ouvertes | Tranchées pour l'Europe et les États-Unis (section 13) |

---

## 2. Les modes

| Mode | Gestionnaire (créateur, vérifié) | Membres | Ce qui est suivi |
|---|---|---|---|
| **Famille** | Parent | Autres adultes du foyer, enfants | Activités, rendez-vous, tâches, planning de la semaine |
| **Équipe sportive** | Entraîneur ou responsable de club | Joueurs (mineurs ou adultes), autres entraîneurs | Entraînements récurrents, matchs, convocations, présences |
| **Classe scolaire** | Enseignant | Élèves, parents | Emploi du temps, devoirs, sorties, réunions parents-enseignants |
| **Équipe de travail** | Responsable | Collaborateurs adultes | Existant, inchangé |

Chaque mode a son vocabulaire, ses modèles d'événements et ses rôles par défaut. Un calendrier a un seul type, choisi à la création.

---

## 3. Rôles et comptes

| Rôle | Compte | Peut |
|---|---|---|
| **Gestionnaire** | Oui, créateur du calendrier, vérifié par Stripe Identity | Crée le calendrier, ajoute les membres, gère les profils mineurs, active les options sensibles |
| **Tuteur** | Oui, adulte | Voit et gère les données des mineurs qu'il suit |
| **Membre adulte** | Oui | Voit ce qui est partagé avec lui |
| **Profil mineur** | Non au départ | Créé par un gestionnaire ou un tuteur. Ses données sont visibles par ses tuteurs et par lui-même |
| **Compte mineur** | Oui, à partir de l'âge du consentement numérique | Voit ses données et peut contester une information le concernant |

Un mineur ne peut jamais être gestionnaire.

---

## 4. Vérification d'identité (Stripe Identity)

### 4.1 Qui et quand
- **Seulement le créateur** d'un calendrier famille, équipe sportive ou classe scolaire, au moment de l'**activation** du mode.
- Les autres membres, les tuteurs et les mineurs ne passent **pas** par Stripe Identity. Leur ajout passe par la déclaration signée (section 14).
- Une seule vérification par créateur, réutilisée pour les calendriers qu'il gère. Nouvelle vérification si le document expire ou si Stripe le demande.

### 4.2 Déroulement
1. L'adulte demande la vérification depuis le calendrier.
2. Une fonction serveur crée une **session de vérification** Stripe et renvoie l'adresse de la page Stripe.
3. L'adulte présente une pièce d'identité et un selfie sur la page hébergée par Stripe. **Collyo ne voit ni ne stocke les documents ni le selfie.**
4. Stripe notifie Collyo par **webhook** (`identity.verification_session.verified` ou `...requires_input`).
5. Collyo enregistre seulement : résultat (vérifié oui/non), date, identifiant de session Stripe, pays de la pièce.

### 4.3 Points à valider
- **Données biométriques** : le selfie relève des données biométriques (RGPD art. 9 quand il sert à identifier). Stripe en est le responsable de traitement pour cette étape. Il faut vérifier le contrat de sous-traitance (DPA) et l'information donnée à l'utilisateur.
- **Disponibilité** : vérifier que Stripe Identity couvre les pays et types de pièces visés, en Europe et en Amérique.
- **Coût** : facturé à la vérification réussie. Tarif à confirmer sur le compte Stripe avant le lancement.
- **Compte partagé (décision du propriétaire)** : le compte Stripe est partagé avec un autre projet, dont le point de terminaison reçoit aussi les événements `identity.verification_session.*`. Les résultats de vérification des créateurs Collyo peuvent donc être transmis à cet autre projet. Décision prise par le propriétaire, à réexaminer avec le juriste avant mise en service (un compte séparé reste recommandé).
- **Refus ou échec** : l'activation reste bloquée, avec la raison générale (« vérification non aboutie ») et un moyen de réessayer. Aucun détail n'est donné à l'entourage.

### 4.4 Ce que la vérification ne prouve pas
Vérifier l'identité ne prouve pas l'**autorité parentale** ni le **rôle d'entraîneur ou d'enseignant**. C'est la question de la section 5.

---

## 5. Preuve de responsabilité

Chaque mode demande une preuve différente. À valider avec le juriste :

| Mode | Preuve proposée | Remarque |
|---|---|---|
| Famille | Déclaration du parent, et accord de l'autre parent si présent | Pas d'autorité externe disponible ; le risque est un conflit entre parents |
| Équipe sportive | Licence ou inscription du club, avec un code remis par le club | Le club ou la fédération valide le gestionnaire |
| Classe scolaire | Code fourni par l'établissement, ou validation par l'administration | Un établissement vérifié devient administrateur du calendrier |

---

## 6. Profil mineur

| Champ | Obligatoire | Raison affichée à l'adulte |
|---|---|---|
| Prénom | Oui | Affichage dans le calendrier |
| Année de naissance | Oui | Savoir si la personne a atteint l'âge du consentement numérique |
| Sexe | Non | Facultatif. Sert seulement si un club ou une ligue impose des catégories |
| Catégorie (U12, 4e B...) | Non | Organisation de l'équipe ou de la classe |

Le sexe est collecté, comme décidé, mais reste **facultatif** et **visible seulement par les gestionnaires et les tuteurs** du profil. Le juriste doit confirmer la base légale.

L'année de naissance est préférée à la date complète : elle suffit à calculer l'âge, avec moins de données.

---

## 7. Visibilité

- Le **mineur** voit toutes les données le concernant.
- Les **tuteurs** voient les données du mineur qu'ils suivent.
- Le **gestionnaire** voit ce qui est nécessaire à l'activité (présences, planning).
- Les **autres membres adultes** ne voient que ce qui est partagé avec eux.

Les mineurs sans compte voient leurs informations à travers leur tuteur, présentées de façon adaptée à leur âge.

---

## 8. Intelligence artificielle et mineurs

### 8.1 Règles
- **Désactivée par défaut** pour tout calendrier comprenant des mineurs.
- Activable par le gestionnaire **uniquement** si le responsable juridique a approuvé le périmètre. L'approbation est enregistrée avec sa référence et sa date.
- Périmètre à définir : lecture des messages, analyse de charge, bilans. Chaque élément se coche séparément.
- Un tuteur peut désactiver l'IA pour le profil de son enfant à tout moment.

### 8.2 Alertes de crise pour un mineur
- Une alerte de crise concernant un mineur va **au tuteur** et au gestionnaire, pas seulement au mineur.
- Elle affiche les numéros d'urgence du pays (112 en Europe, 911 aux États-Unis et au Canada, 999 au Royaume-Uni) et une ressource d'écoute pour jeunes.
- Le juriste et un professionnel de santé mentale doivent valider ce parcours avant toute mise en service.

---

## 9. Cadre légal par zone (à confirmer par le juriste)

- **Europe (RGPD)** : âge du consentement numérique variable selon les pays (13 à 16 ans). Consentement du titulaire de l'autorité parentale en dessous. Information adaptée à l'âge.
- **États-Unis (COPPA)** : consentement parental vérifiable pour les moins de 13 ans. Des lois d'États imposent des règles supplémentaires.
- **Canada (Québec)** : loi 25 sur la protection des renseignements personnels, règles propres aux mineurs.
- **Stripe Identity** et les données biométriques : à vérifier pour chaque zone.

---

## 10. Conservation et droits

- Données du mineur : supprimées sur demande du tuteur ou du mineur, et à la fin de la scolarité ou de l'adhésion.
- Exports : le tuteur peut exporter les données du mineur qu'il suit.
- À la majorité ou à l'âge du consentement : le mineur reçoit son propre compte et contrôle ses données.
- Vérifications d'identité : seule la trace du résultat est conservée, pas les documents.
- Journal de l'approbation juridique de l'IA : conservé tant que l'option est active.

---

## 11. Modèle de données (esquisse)

- `calendars.kind` : `personal | family | sports | class | work`.
- `calendars.verified_manager_id` : adulte vérifié qui active les options sensibles.
- `identity_verifications` : user_id, statut (pending | verified | failed), pays, date, `stripe_session_id`. Pas de document.
- `managed_profiles` : id, calendar_id, prénom, année de naissance, sexe (nullable), catégorie, date du compte propre (nullable).
- `guardianships` : profile_id, user_id tuteur, rôle, date.
- `ai_legal_approvals` : calendar_id, périmètre, référence de l'avis, date, approuvé par.
- RLS : les profils mineurs sont lisibles seulement par leurs tuteurs, le gestionnaire et le mineur lui-même.

---

## 12. Ordre de réalisation proposé

1. Validation de ce document par le responsable juridique (sections 4, 5, 6, 8, 9).
2. Compte Stripe : activation de Stripe Identity, clés, webhook, DPA.
3. Types de calendriers et rôles (migrations, RLS, tests).
4. Vérification d'identité et preuve de responsabilité.
5. Profils mineurs, tuteurs, visibilité.
6. Modes famille, équipe sportive, classe : modèles d'événements et vues.
7. IA pour les mineurs, uniquement après approbation juridique enregistrée.
8. Tests de sécurité des règles RLS avec des comptes adulte, tuteur et mineur.

---

## 13. Décisions sur les questions ouvertes (Europe et États-Unis)

Choix retenus, à confirmer par le juriste avant mise en service.

1. **Âge du consentement numérique : 16 ans** dans les deux zones. C'est le seuil le plus strict parmi les pays européens visés et il couvre les exigences américaines. En dessous, un majeur responsable doit signer (section 14). Pour les moins de 13 ans aux États-Unis (COPPA), le consentement parental vérifiable est obligatoire.
2. **Sexe du mineur** : base légale = consentement explicite du majeur responsable, donné par la déclaration signée. Affiché seulement aux gestionnaires et tuteurs, jamais aux autres membres.
3. **IA pour les mineurs** : activable seulement si le responsable juridique a approuvé le périmètre **et** si un majeur responsable a signé la déclaration (section 14).
4. **Famille quand les parents ne sont pas d'accord** : une déclaration signée suffit pour les fonctions de base. Pour les fonctions sensibles (IA, sexe), la signature de **chaque tuteur connu** est requise. Un tuteur qui conteste peut demander le retrait de l'enfant du calendrier, et Collyo applique la demande.
5. **Alerte de crise pour un mineur** : elle va au tuteur et au gestionnaire, avec les numéros d'urgence du pays et une ligne d'écoute pour jeunes. Collyo n'est pas un service d'urgence : les conditions d'utilisation le disent clairement, et l'alerte ne remplace pas un appel aux secours.
6. **Stripe Identity et données biométriques** : utiliser le contrat de traitement standard de Stripe (DPA). Stripe traite le selfie pour la vérification. Collyo ne stocke que le résultat.

---

## 14. Déclaration signée et mise en revue

### 14.1 Principe
Un profil mineur, ou une fonction sensible, n'est actif qu'après la **déclaration signée** d'un **adulte responsable** : le créateur du calendrier, ou un autre adulte responsable désigné. Tant qu'elle n'est pas signée, l'ajout du mineur reste **en revue**. Stripe Identity n'intervient pas à cette étape.

### 14.2 Contenu de la déclaration
Le majeur déclare :
- qu'il a l'autorité parentale, ou le rôle de gestionnaire pour ce mode ;
- les données collectées sur le mineur (prénom, année de naissance, sexe si renseigné, catégorie) et leur finalité ;
- les fonctions activées (IA, sexe, analyse de charge) ;
- qu'il peut retirer son accord à tout moment, et les conséquences du retrait.

Le texte est versionné. Chaque signature est liée à la version exacte acceptée.

### 14.3 Signature
- Le signataire tape **son nom et son prénom**. Pour le **créateur**, ils doivent correspondre à ceux de la vérification Stripe Identity. Pour un **autre adulte responsable**, sans Stripe Identity, ils doivent correspondre au nom enregistré sur son compte. En cas d'écart, la signature est refusée.
- Limite connue : un autre adulte n'est pas vérifié. Le créateur, lui, l'est, et reste le responsable de l'activation. Le juriste doit confirmer que cela suffit pour les fonctions sensibles.
- Il s'agit d'une **signature électronique simple** : valable au sens du règlement eIDAS en Europe, et de l'ESIGN Act / UETA aux États-Unis. Le juriste confirme que ce niveau suffit pour chaque fonction.
- Collyo conserve : identifiant du signataire, nom et prénom tapés, résultat de correspondance, version du texte, date et heure. Pas d'adresse IP ni de document d'identité.

### 14.4 Statut « en revue »
- Un profil mineur ajouté sans déclaration signée est **en revue** : il n'apparaît pas dans le calendrier et ne reçoit aucune donnée.
- Le gestionnaire voit le profil en revue, avec la date de la demande et un bouton pour renvoyer la déclaration.
- Un profil non signé est **supprimé automatiquement après 30 jours**.
- Dès la signature, le profil devient actif.

### 14.5 Fonctions soumises à signature
| Fonction | Signature requise |
|---|---|
| Ajouter un profil mineur | Oui (le profil reste en revue sinon) |
| Renseigner le sexe | Oui |
| IA sur les messages ou l'agenda du mineur | Oui, plus l'approbation juridique enregistrée |
| Analyse de charge ou bilans bien-être du mineur | Oui |
| Compte propre du mineur (à 16 ans) | Consentement du mineur, puis information du tuteur |

### 14.6 Modèle de données (ajout)
- `declarations` : id, calendar_id, signataire (user_id), nom_saisi, prénom_saisi, correspondance (booléen), version_texte, fonctions_couvertes, signé_le (nullable), créé_le.
- `managed_profiles.statut` : `en_revue | actif | retiré`.
- Index de suppression : profils `en_revue` depuis plus de 30 jours.

### 14.7 Ordre de réalisation (mise à jour)
La signature et la mise en revue passent avant les profils mineurs (section 12, étape 5), car aucun profil n'est actif sans elles.
