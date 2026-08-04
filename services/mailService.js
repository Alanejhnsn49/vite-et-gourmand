const nodemailer = require('nodemailer');
require('dotenv').config();

/**
 * Service d'envoi d'emails.
 *
 * Toutes les notifications de l'application passent par ce module. Les
 * controleurs ne construisent jamais d'email eux-memes : ils appellent une
 * fonction nommee d'apres l'evenement metier. Cela garantit une presentation
 * homogene et permet de changer de fournisseur SMTP sans toucher au metier.
 *
 * En developpement, MAIL_HOST pointe sur le conteneur Mailpit, qui capture
 * les messages sans jamais les remettre a un vrai destinataire. En
 * production, il suffit de renseigner les identifiants d'un relais reel.
 */

const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const FROM = process.env.MAIL_FROM || 'Vite & Gourmand <contact@viteetgourmand.fr>';
const ADRESSE_CONTACT = process.env.MAIL_CONTACT || 'contact@viteetgourmand.fr';

const transporteur = nodemailer.createTransport({
    host: process.env.MAIL_HOST || 'localhost',
    port: Number(process.env.MAIL_PORT) || 1025,
    secure: process.env.MAIL_SECURE === 'true',
    // Mailpit n'exige aucune authentification : on ne transmet des
    // identifiants que s'ils sont reellement configures.
    auth: process.env.MAIL_USER
        ? { user: process.env.MAIL_USER, pass: process.env.MAIL_PASSWORD }
        : undefined,
});

/**
 * Echappe les caracteres HTML d'une valeur avant insertion dans un gabarit.
 *
 * Un nom ou un message provenant d'un formulaire est du texte non fiable.
 * Sans echappement, un utilisateur pourrait injecter du balisage dans un
 * email lu par un employe.
 */
function echapper(valeur) {
    if (valeur === null || valeur === undefined) return '';
    return String(valeur)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Gabarit commun : en-tete, contenu, pied de page.
 */
function gabarit(titre, corps) {
    return `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;">
      <div style="background:#7c2d12;padding:20px 24px;">
        <h1 style="margin:0;color:#ffffff;font-size:20px;">Vite &amp; Gourmand</h1>
      </div>
      <div style="padding:24px;">
        <h2 style="margin-top:0;font-size:18px;">${titre}</h2>
        ${corps}
      </div>
      <div style="padding:16px 24px;background:#f9fafb;font-size:12px;color:#6b7280;">
        Vite &amp; Gourmand, service traiteur a Bordeaux.<br>
        Cet email vous est envoye automatiquement, merci de ne pas y repondre.
      </div>
    </div>
  </body>
</html>`;
}

/**
 * Envoi bas niveau.
 *
 * Un echec d'envoi ne doit jamais interrompre un parcours metier : une
 * inscription ou une commande reste valide meme si la notification echoue.
 * L'erreur est journalisee et la fonction renvoie false.
 */
async function envoyer({ to, subject, html }) {
    try {
        const info = await transporteur.sendMail({ from: FROM, to, subject, html });
        return { succes: true, messageId: info.messageId };
    } catch (error) {
        console.error(`Email non envoyé à ${to} (${subject}) :`, error.message);
        return { succes: false, erreur: error.message };
    }
}

/**
 * Email de bienvenue, envoye a la creation d'un compte.
 * Exige par le cahier des charges : "il recevra en reponse a son
 * inscription, un mail de bienvenue de maniere automatique".
 */
async function envoyerBienvenue(utilisateur) {
    const prenom = echapper(utilisateur.prenom);
    return envoyer({
        to: utilisateur.email,
        subject: 'Bienvenue chez Vite & Gourmand',
        html: gabarit(`Bonjour ${prenom},`, `
            <p>Votre compte a bien ete cree. Vous pouvez des maintenant consulter nos menus et passer commande.</p>
            <p style="margin:24px 0;">
              <a href="${APP_URL}/menus.html" style="background:#7c2d12;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Decouvrir nos menus</a>
            </p>
            <p>A tres vite,<br>Julie et Jose</p>
        `),
    });
}

/**
 * Confirmation de commande.
 * Exige par le cahier des charges : "apres avoir commande un menu, le
 * visiteur va recevoir un mail lui confirmant la commande".
 */
async function envoyerConfirmationCommande(utilisateur, commande, menu, detail) {
    const datePrestation = new Date(commande.date_prestation).toLocaleDateString('fr-FR');

    const ligneRemise = detail.remise_applicable
        ? `<tr><td style="padding:6px 0;">Remise de 10 % (${detail.convives_supplementaires} convives supplementaires)</td>
             <td style="padding:6px 0;text-align:right;color:#15803d;">- ${detail.montant_remise.toFixed(2)} EUR</td></tr>`
        : '';

    const ligneLivraison = detail.hors_bordeaux
        ? `<tr><td style="padding:6px 0;">Livraison hors Bordeaux (${detail.distance_km} km)</td>
             <td style="padding:6px 0;text-align:right;">${detail.frais_livraison.toFixed(2)} EUR</td></tr>`
        : `<tr><td style="padding:6px 0;">Livraison dans Bordeaux</td>
             <td style="padding:6px 0;text-align:right;">offerte</td></tr>`;

    return envoyer({
        to: utilisateur.email,
        subject: `Confirmation de votre commande n°${commande.id}`,
        html: gabarit(`Merci ${echapper(utilisateur.prenom)}, votre commande est enregistree.`, `
            <p><strong>${echapper(menu.titre)}</strong><br>
               Prestation du ${datePrestation} a ${echapper(commande.heure_prestation)}<br>
               ${echapper(commande.adresse_livraison)}, ${echapper(commande.ville_livraison)}<br>
               ${detail.nombre_convives} convives</p>

            <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:16px;">
              <tr><td style="padding:6px 0;">Prestation</td>
                  <td style="padding:6px 0;text-align:right;">${detail.prix_menu_brut.toFixed(2)} EUR</td></tr>
              ${ligneRemise}
              ${ligneLivraison}
              <tr><td style="padding:12px 0;border-top:1px solid #e5e7eb;font-weight:bold;">Total</td>
                  <td style="padding:12px 0;border-top:1px solid #e5e7eb;text-align:right;font-weight:bold;">${detail.total_ttc.toFixed(2)} EUR</td></tr>
            </table>

            <p style="margin-top:20px;">Votre commande est au statut <strong>en attente</strong>. Notre equipe la validera prochainement et vous pourrez suivre son avancement depuis votre espace.</p>

            <p style="margin:24px 0;">
              <a href="${APP_URL}/dashboard.html" style="background:#7c2d12;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Suivre ma commande</a>
            </p>

            <p style="font-size:13px;color:#6b7280;">Conditions du menu : ${echapper(menu.conditions)}</p>
        `),
    });
}

/**
 * Notification de creation d'un compte employe par l'administrateur.
 *
 * Cahier des charges : "l'employe en question va recevoir un mail lui
 * notifiant qu'un compte pour lui a ete cree, cependant, le mot de passe
 * n'est pas communique dans le mail. Il devra se rapprocher de
 * l'administrateur afin de l'obtenir."
 *
 * Le mot de passe n'est donc jamais transmis ici. C'est aussi une bonne
 * pratique en soi : un email transite en clair et reste stocke durablement
 * chez le destinataire.
 */
async function envoyerCreationCompteEmploye(employe) {
    return envoyer({
        to: employe.email,
        subject: 'Votre compte Vite & Gourmand a été créé',
        html: gabarit(`Bonjour ${echapper(employe.prenom)},`, `
            <p>Un compte employe vient d'etre cree pour vous sur la plateforme Vite &amp; Gourmand.</p>
            <p>Votre identifiant de connexion est votre adresse email : <strong>${echapper(employe.email)}</strong></p>
            <div style="border-left:4px solid #7c2d12;background:#fef7f2;padding:16px;margin:20px 0;">
              <p style="margin:0;">Pour des raisons de securite, <strong>votre mot de passe ne figure pas dans cet email</strong>. Rapprochez-vous de votre administrateur pour l'obtenir.</p>
            </div>
            <p style="margin:24px 0;">
              <a href="${APP_URL}/login.html" style="background:#7c2d12;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Se connecter</a>
            </p>
        `),
    });
}

/**
 * Notification de changement de statut d'une commande.
 * Le client suit l'avancement de sa prestation sans avoir a se connecter.
 */
async function envoyerChangementStatut(utilisateur, commande, menuTitre, libelleStatut) {
    return envoyer({
        to: utilisateur.email,
        subject: `Commande n°${commande.id} : ${libelleStatut}`,
        html: gabarit(`Bonjour ${echapper(utilisateur.prenom)},`, `
            <p>Votre commande <strong>n°${commande.id}</strong> pour le menu
               <strong>${echapper(menuTitre)}</strong> vient de passer au statut :</p>
            <p style="font-size:18px;font-weight:bold;color:#7c2d12;">${echapper(libelleStatut)}</p>
            <p style="margin:24px 0;">
              <a href="${APP_URL}/dashboard.html" style="background:#7c2d12;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Suivre ma commande</a>
            </p>
        `),
    });
}

/**
 * Notification de retour de materiel.
 * Cahier des charges : "des que ce statut est atteint, le client recoit un
 * mail lui notifiant que si sous 10 jours ouvres le materiel n'est pas
 * restitue, alors il devra s'acquitter de 600 euros de frais".
 */
async function envoyerRetourMateriel(utilisateur, commande, delaiJours, penalite) {
    return envoyer({
        to: utilisateur.email,
        subject: `Commande n°${commande.id} : restitution du matériel prêté`,
        html: gabarit(`Bonjour ${echapper(utilisateur.prenom)},`, `
            <p>Du materiel vous a ete prete pour votre prestation (commande n°${commande.id}).</p>
            <div style="border-left:4px solid #dc2626;background:#fef2f2;padding:16px;margin:20px 0;">
              <p style="margin:0;"><strong>Merci de nous le restituer sous ${delaiJours} jours ouvres.</strong></p>
              <p style="margin:8px 0 0;">Passe ce delai, des frais de <strong>${penalite} euros</strong> vous seront factures, conformement aux conditions generales de vente.</p>
            </div>
            <p>Pour organiser la restitution, prenez contact avec nous a l'adresse ${ADRESSE_CONTACT}.</p>
        `),
    });
}

/**
 * Invitation a deposer un avis, envoyee une fois la commande terminee.
 * Cahier des charges : "quand la commande est terminee, alors l'utilisateur
 * est notifie par mail qu'il peut se connecter a son compte pour donner son
 * avis depuis la commande".
 */
async function envoyerInvitationAvis(utilisateur, commande, menuTitre) {
    return envoyer({
        to: utilisateur.email,
        subject: `Votre avis sur la commande n°${commande.id}`,
        html: gabarit(`Merci ${echapper(utilisateur.prenom)} !`, `
            <p>Votre prestation <strong>${echapper(menuTitre)}</strong> est terminee. Nous esperons qu'elle vous a plu.</p>
            <p>Vous pouvez maintenant deposer un avis depuis votre espace : une note de 1 a 5 et un commentaire.</p>
            <p style="margin:24px 0;">
              <a href="${APP_URL}/dashboard.html" style="background:#7c2d12;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Donner mon avis</a>
            </p>
        `),
    });
}

/**
 * Notification d'annulation, avec le motif et le canal de contact renseignes
 * par l'employe.
 */
async function envoyerAnnulation(utilisateur, commande, motif, canal) {
    const ligneContact = canal
        ? `<p style="font-size:13px;color:#6b7280;">Vous avez ete contacte par ${canal === 'gsm' ? 'telephone' : 'email'} prealablement a cette annulation.</p>`
        : '';

    return envoyer({
        to: utilisateur.email,
        subject: `Commande n°${commande.id} annulée`,
        html: gabarit(`Bonjour ${echapper(utilisateur.prenom)},`, `
            <p>Votre commande <strong>n°${commande.id}</strong> a ete annulee.</p>
            ${motif ? `<div style="border-left:4px solid #e5e7eb;padding-left:12px;margin:16px 0;"><strong>Motif :</strong> ${echapper(motif)}</div>` : ''}
            ${ligneContact}
            <p>Pour toute question, ecrivez-nous a ${ADRESSE_CONTACT}.</p>
        `),
    });
}

/**
 * Lien de reinitialisation de mot de passe.
 * Exige par le cahier des charges : "si le mot de passe est oublie, il pourra
 * le reinitialiser via un bouton prevu a cet effet : un lien par mail lui sera
 * envoye afin de l'inviter a le reinitialiser".
 */
async function envoyerReinitialisation(utilisateur, jeton, dureeMinutes) {
    const lien = `${APP_URL}/reinitialisation.html?jeton=${encodeURIComponent(jeton)}`;

    return envoyer({
        to: utilisateur.email,
        subject: 'Réinitialisation de votre mot de passe',
        html: gabarit(`Bonjour ${echapper(utilisateur.prenom)},`, `
            <p>Vous avez demande la reinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.</p>
            <p style="margin:24px 0;">
              <a href="${lien}" style="background:#7c2d12;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Choisir un nouveau mot de passe</a>
            </p>
            <p style="font-size:13px;color:#6b7280;">Ce lien est valable ${dureeMinutes} minutes et ne peut servir qu'une seule fois.</p>
            <p style="font-size:13px;color:#6b7280;">Si vous n'etes pas a l'origine de cette demande, ignorez simplement cet email : votre mot de passe actuel reste inchange.</p>
            <p style="font-size:12px;color:#9ca3af;word-break:break-all;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>${lien}</p>
        `),
    });
}

/**
 * Confirmation apres changement effectif du mot de passe.
 * Permet a l'utilisateur de reagir si le changement ne vient pas de lui.
 */
async function envoyerConfirmationChangementMotDePasse(utilisateur) {
    return envoyer({
        to: utilisateur.email,
        subject: 'Votre mot de passe a été modifié',
        html: gabarit(`Bonjour ${echapper(utilisateur.prenom)},`, `
            <p>Votre mot de passe vient d'etre modifie. Vous pouvez des maintenant vous connecter avec le nouveau.</p>
            <p style="font-size:13px;color:#6b7280;">Si vous n'etes pas a l'origine de ce changement, contactez-nous immediatement a ${ADRESSE_CONTACT}.</p>
        `),
    });
}

/**
 * Transmission d'une demande de contact a l'entreprise.
 * Exige par le cahier des charges : "pour donner suite a cet envoi, la
 * demande est envoyee par mail a l'entreprise".
 */
async function envoyerDemandeContact({ titre, description, email }) {
    return envoyer({
        to: ADRESSE_CONTACT,
        subject: `Nouvelle demande de contact : ${titre}`,
        html: gabarit('Nouvelle demande depuis le formulaire de contact', `
            <p><strong>Expediteur :</strong> ${echapper(email)}</p>
            <p><strong>Objet :</strong> ${echapper(titre)}</p>
            <p style="white-space:pre-wrap;border-left:3px solid #e5e7eb;padding-left:12px;">${echapper(description)}</p>
        `),
    });
}

/**
 * Accuse de reception envoye a la personne qui a rempli le formulaire.
 */
async function envoyerAccuseContact({ titre, email }) {
    return envoyer({
        to: email,
        subject: 'Nous avons bien recu votre message',
        html: gabarit('Votre message nous est bien parvenu', `
            <p>Objet : <strong>${echapper(titre)}</strong></p>
            <p>Julie et Jose vous repondront dans les meilleurs delais a cette adresse.</p>
        `),
    });
}

/**
 * Verifie que le serveur SMTP est joignable. Appele au demarrage.
 */
async function verifierConnexion() {
    try {
        await transporteur.verify();
        console.log('✅ Serveur SMTP joignable.');
        return true;
    } catch (error) {
        console.error('❌ Serveur SMTP injoignable :', error.message);
        return false;
    }
}

module.exports = {
    envoyerBienvenue,
    envoyerConfirmationCommande,
    envoyerCreationCompteEmploye,
    envoyerChangementStatut,
    envoyerRetourMateriel,
    envoyerInvitationAvis,
    envoyerAnnulation,
    envoyerReinitialisation,
    envoyerConfirmationChangementMotDePasse,
    envoyerDemandeContact,
    envoyerAccuseContact,
    verifierConnexion,
};
