const mail = require('../services/mailService');

// Expression volontairement permissive : elle ecarte les saisies
// manifestement invalides sans rejeter des adresses legitimes exotiques.
const FORMAT_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LONGUEUR_MAX_TITRE = 150;
const LONGUEUR_MAX_DESCRIPTION = 2000;

/**
 * POST /api/contact
 *
 * Cahier des charges : "il aura acces a un formulaire qui va lui demander un
 * titre, une description ainsi que son mail afin qu'il puisse obtenir une
 * reponse. Pour donner suite a cet envoi, la demande est envoyee par mail a
 * l'entreprise."
 *
 * Accessible sans authentification : un visiteur doit pouvoir ecrire.
 */
exports.envoyerMessage = async (req, res) => {
    const { titre, description, email } = req.body;

    // Validation serveur. Les attributs required du formulaire ne sont pas
    // une garantie : la requete peut etre forgee hors du navigateur.
    const erreurs = [];

    if (!titre || !titre.trim()) {
        erreurs.push('Le titre est obligatoire.');
    } else if (titre.trim().length > LONGUEUR_MAX_TITRE) {
        erreurs.push(`Le titre ne peut pas dépasser ${LONGUEUR_MAX_TITRE} caractères.`);
    }

    if (!description || !description.trim()) {
        erreurs.push('La description est obligatoire.');
    } else if (description.trim().length > LONGUEUR_MAX_DESCRIPTION) {
        erreurs.push(`La description ne peut pas dépasser ${LONGUEUR_MAX_DESCRIPTION} caractères.`);
    }

    if (!email || !FORMAT_EMAIL.test(email.trim())) {
        erreurs.push('Une adresse email valide est obligatoire.');
    }

    if (erreurs.length > 0) {
        return res.status(400).json({ error: 'Formulaire invalide.', details: erreurs });
    }

    const donnees = {
        titre: titre.trim(),
        description: description.trim(),
        email: email.trim().toLowerCase(),
    };

    try {
        // La demande part vers l'entreprise, l'accuse de reception vers le
        // visiteur. Les deux envois sont independants : si l'accuse echoue,
        // la demande a tout de meme ete transmise.
        const resultat = await mail.envoyerDemandeContact(donnees);
        await mail.envoyerAccuseContact(donnees);

        if (!resultat.succes) {
            return res.status(502).json({
                error: "Votre message n'a pas pu être transmis. Merci de réessayer plus tard.",
            });
        }

        res.status(201).json({
            message: 'Votre message a bien été transmis. Vous recevrez une réponse à cette adresse.',
        });
    } catch (error) {
        console.error('Erreur lors du traitement du formulaire de contact :', error);
        res.status(500).json({ error: 'Une erreur interne est survenue.' });
    }
};
