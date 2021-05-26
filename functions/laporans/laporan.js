const admin = require("firebase-admin");
const { body, validationResult } = require("express-validator");
const mime = require("mime-types");

exports.validators = [
  body("alamat").notEmpty().withMessage("alamat harus diisi"),
  body("deskripsi").notEmpty().withMessage("deskripsi harus diisi"),
  body("foto").notEmpty().withMessage("foto harus diisi"),
  body("kondisi_kerusakan").notEmpty()
      .withMessage("kondisi_kerusakan harus diisi"),
  body("latitude").notEmpty()
      .withMessage("latitude harus diisi").isFloat("Harus barupa angka"),
  body("longitude").notEmpty()
      .withMessage("latitude harus diisi").isFloat("Harus barupa angka"),
];

exports.create = async (req, res) =>{
  const { authorization } = req.headers;
  const split = authorization.split(" ");
  const token = split[1];
  const decodeToken = await admin.auth().verifyIdToken(token);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  // eslint-disable-next-line prefer-const
  let data = req.body;
  const mimeType = base64MimeType(req.body.foto);
  data.id_pelapor = decodeToken.uid;


  const { id } = await admin.firestore().collection("laporans").add(data);

  const publicUrl = await uploadAndGetPublicFile(
      id +"." + mime.extension(mimeType),
      req.body.foto
  );

  data.foto = publicUrl;

  await admin.firestore().collection("laporans").doc(id).update(data);

  return res.status(201).send(JSON.stringify({ id }));
};


exports.all = async (req, res) => {
  const snapshot = await admin.firestore().collection("laporans").get();

  // eslint-disable-next-line prefer-const
  let data = [];
  snapshot.forEach((doc) => {
    const id = doc.id;
    const d = doc.data();

    data.push({ id, ...d });
  });

  return res.status(200).send(JSON.stringify(data));
};

exports.get = async (req, res) => {
  const snapshot = await admin.firestore()
      .collection("laporans").doc(req.params.id).get();

  const id = snapshot.id;
  const data = snapshot.data();

  if (!data) {
    return res.status(404).send("data not found");
  }

  return res.status(200).send(JSON.stringify({ id: id, ...data }));
};


exports.remove = async (req, res) => {
  await admin.firestore()
      .collection("laporans").doc(req.params.id).delete();
  return res.status(200).send();
};

const uploadAndGetPublicFile = async (fileName, data) => {
  const file = admin.storage().bucket().file("public/"+fileName);

  const fileOptions = {
    public: true,
    resumable: false,
    metadata: { contentType: base64MimeType(data) },
    validation: false,
  };
  const base64encodedString = data.replace(/^data:\w+\/\w+;base64,/, "");
  const fileBuffer = Buffer.from(base64encodedString, "base64");
  await file.save(fileBuffer, fileOptions);
  const publicUrl = `https://storage.googleapis.com/tensile-ship-312415.appspot.com/public/${fileName}`;
  return publicUrl;
};

function base64MimeType(encoded) {
  let result = null;

  if (typeof encoded !== "string") {
    return result;
  }

  const mime = encoded.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/);

  if (mime && mime.length) {
    result = mime[1];
  }

  return result;
}
